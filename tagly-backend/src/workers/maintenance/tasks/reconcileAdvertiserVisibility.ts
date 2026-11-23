import { VISIBILITY_BUDGETS } from "@tagly/models/shared";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { db } from "../../../db/kysely.js";
import prisma from "../../../prisma/prisma.js";
import { applyBusinessAccessibleFilter } from "../../../utils/businesses/businessAccessibility.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Visibility reconciler — the ONE place advertisers are notified that their
 * account became visible / stopped being visible.
 *
 * State reconciliation instead of call-site wiring: every path that can flip
 * visibility (credit spend at settlement, PAYG link/unlink, charge-failure
 * period close, negative balance, refunds, business ban/deletion, admin
 * changes, future features) is covered automatically, because the task diffs
 * the CURRENT account-level roll-up (`businessAccessibleSql`, the canonical
 * rule) against the persisted `Advertiser.lastKnownVisible`.
 *
 * Mechanics per cycle (idempotent, singleton via the maintenance lock):
 *   1. One query for the set of currently-visible advertiser ids (any business
 *      passing the accessibility rule), one for all advertisers' last-known
 *      state.
 *   2. `lastKnownVisible IS NULL` rows are SEEDED silently (bulk CAS update, no
 *      notification) — first deploy and new advertisers never get a
 *      transition notice for their initial state.
 *   3. A real transition is claimed with a CAS update
 *      (`updateMany where lastKnownVisible = <old>`); only the claim winner
 *      queues, so a concurrent run can't double-notify.
 *
 * Anti-spam: sub-cycle flips (visible for 5 minutes) are never observed, and
 * the daily dedupe keys cap each direction at one notification per day even if
 * the state oscillates across cycles.
 *
 * ONE slug both ways: `a.account.visibility-change`, payload `{ visible,
 * cause? }` — the template branches copy (and the email surfaces the reason).
 * Cause ladder for a visible → not-visible transition (a statement about the
 * CURRENT state, mirroring the client's `useVisibilityCause`):
 *   1. negative balance            → cause "negativeBalance"
 *   2. no ACTIVE business page     → skip (ban/deletion have their own notices;
 *                                    a deleted page is self-evident in-app)
 *   3. recent CHARGE_FAILED close  → skip (`a.balance.payg-charge-failed`
 *                                    already told them, with better context)
 *   4. recent CARD_REMOVED close   → cause "paygRemoved"
 *   5. credits below the minimum   → cause "lowBalance"
 *   6. anything else               → no cause (generic copy)
 * (No subsidization causes: a business is platform-subsidized XOR
 * advertiser-owned, so a notifiable advertiser never loses visibility to a
 * subsidy change.)
 */
export const reconcileAdvertiserVisibility: MaintenanceTask = {
  name: "reconcileAdvertiserVisibility",
  run: async ({ now, log }) => {
    // 1) Current truth: advertisers with at least one accessible business.
    const visibleRows = await applyBusinessAccessibleFilter(
      db
        .selectFrom("app.local_subaccounts as ls")
        .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
        .leftJoin(
          "app.advertiser_sensitive_data as asd",
          "asd.id",
          "a.sensitive_data_id",
        )
        .select("ls.advertiser_id as advertiserId")
        .where("ls.advertiser_id", "is not", null)
        .distinct(),
    ).execute();
    const visibleIds = new Set(
      visibleRows
        .map((r) => r.advertiserId)
        .filter((id): id is number => id !== null),
    );

    // 2) Last-known state for everyone (small table; revisit if it ever isn't).
    const advertisers = await prisma.advertiser.findMany({
      select: { id: true, lastKnownVisible: true },
    });

    // 3) Seed never-evaluated rows silently, in two bulk CAS updates.
    const seedVisible: number[] = [];
    const seedHidden: number[] = [];
    const flipped: { id: number; nowVisible: boolean }[] = [];
    for (const a of advertisers) {
      const nowVisible = visibleIds.has(a.id);
      if (a.lastKnownVisible === null) {
        (nowVisible ? seedVisible : seedHidden).push(a.id);
      } else if (a.lastKnownVisible !== nowVisible) {
        flipped.push({ id: a.id, nowVisible });
      }
    }
    if (seedVisible.length > 0) {
      await prisma.advertiser.updateMany({
        where: { id: { in: seedVisible }, lastKnownVisible: null },
        data: { lastKnownVisible: true },
      });
    }
    if (seedHidden.length > 0) {
      await prisma.advertiser.updateMany({
        where: { id: { in: seedHidden }, lastKnownVisible: null },
        data: { lastKnownVisible: false },
      });
    }

    if (flipped.length === 0) return;
    log.info("visibility transitions detected", { count: flipped.length });

    const day = now.toISOString().slice(0, 10);
    const causeWindowStart = new Date(
      now.getTime() - T.visibilityCauseWindowMs,
    );

    for (const { id: advertiserId, nowVisible } of flipped) {
      // Claim the transition; a concurrent cycle or a state that moved again
      // under us loses the CAS and notifies nothing.
      const { count } = await prisma.advertiser.updateMany({
        where: { id: advertiserId, lastKnownVisible: !nowVisible },
        data: { lastKnownVisible: nowVisible },
      });
      if (count === 0) continue;

      if (nowVisible) {
        await queueNotificationJobs({
          advertiserIds: [advertiserId],
          eventSlug: "a.account.visibility-change",
          payload: { visible: true },
          dedupeKey: `visibility-change-${advertiserId}-visible-${day}`,
        });
        continue;
      }

      // ---- not-visible cause ladder (current state, not the trigger event) ----
      const facts = await prisma.advertiser.findUnique({
        where: { id: advertiserId },
        select: {
          sensitiveData: { select: { availableBudgetUsdCents: true } },
          locals: { select: { status: true } },
          paygPeriods: {
            where: { endedAt: { not: null } },
            orderBy: { endedAt: "desc" },
            take: 1,
            select: { endedAt: true, endedReason: true },
          },
        },
      });
      if (!facts) continue; // deleted mid-cycle

      const available = facts.sensitiveData.availableBudgetUsdCents;
      const hasActivePage = facts.locals.some((l) => l.status === "ACTIVE");
      const lastEnd = facts.paygPeriods[0];
      const recentPaygEnd =
        lastEnd?.endedAt && lastEnd.endedAt >= causeWindowStart
          ? lastEnd.endedReason
          : null;

      if (!hasActivePage && available >= 0n) {
        // Ban has its own mandatory email; a self-deleted page is self-evident.
        continue;
      }
      if (recentPaygEnd === "CHARGE_FAILED" && available >= 0n) {
        // `a.balance.payg-charge-failed` already told them, with the decline
        // context the state can't reconstruct.
        continue;
      }

      const cause =
        available < 0n
          ? "negativeBalance"
          : recentPaygEnd === "CARD_REMOVED"
            ? "paygRemoved"
            : available < BigInt(VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS)
              ? "lowBalance"
              : undefined;

      await queueNotificationJobs({
        advertiserIds: [advertiserId],
        eventSlug: "a.account.visibility-change",
        payload: { visible: false, ...(cause ? { cause } : {}) },
        dedupeKey: `visibility-change-${advertiserId}-hidden-${day}`,
      });
    }
  },
};
