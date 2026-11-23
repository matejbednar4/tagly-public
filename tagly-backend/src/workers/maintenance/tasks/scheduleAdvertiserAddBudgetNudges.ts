import prisma from "../../../prisma/prisma.js";
import { promoEventsRaw } from "../../../constants/catalogs/notifications/promoCatalog.js";
import { queuePromoNotificationJobsOrReturn } from "../../../utils/queue/queuePromoNotificationJobsOrReturn.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { PromoEventSlug } from "../../../constants/catalogs/notifications/promoCatalog.js";
import type { MaintenanceTask } from "./index.js";
import { CREDIT_PURCHASE_LEDGER_EVENT_WHERE } from "../../../utils/money/ledger/advertiserCreditPurchases.js";

/**
 * Queues "add budget" nudges for advertisers who never funded — the key
 * conversion sequence (v2.0.0.md §Notifications Phase 4).
 *
 * Windows are measured from Advertiser.createdAt. Eligibility mirrors
 * `isAdvertiserFunded` in the notifications worker, inverted and set-based:
 * NOT funded = no open PAYG period, zero available + locked balance, zero
 * credit purchases ever, AND no PAYG card on file (a card counts as funded —
 * never nag someone who just added one). Deliberately NOT gated on having a
 * business page: pages are often created by the team from admin with a delay,
 * and the copy never assumes one exists.
 *
 * Funding mid-sequence ends it twice over: this query stops matching (no more
 * steps queue), and the worker's send-time `isAdvertiserFunded` re-check kills
 * any already-queued legs. Consent uses the advertiser's non-null flag.
 */
export const scheduleAdvertiserAddBudgetNudges: MaintenanceTask = {
  name: "schedule advertiser add-budget nudges",
  run: async ({ now, log }) => {
    for (const [slug, event] of Object.entries(promoEventsRaw)) {
      if (event.cadence.kind !== "advertiserAddBudgetNudge") continue;

      const { minDays, maxDays } = event.cadence;
      const minAgo = new Date(now.getTime() - minDays * 24 * 60 * 60 * 1000);
      const maxAgo = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

      let totalEligible = 0;
      let totalQueued = 0;
      let lastId = 0;

      while (true) {
        const batch = await prisma.advertiser.findMany({
          where: {
            id: { gt: lastId },
            promoNotificationsEnabled: true,
            createdAt: { lte: minAgo, gt: maxAgo },
            promoNotificationLogs: { none: { eventSlug: slug } },
            // Never funded (the isAdvertiserFunded formula, inverted):
            sensitiveData: {
              is: {
                availableBudgetUsdCents: 0n,
                lockedBudgetUsdCents: 0n,
                savedPaymentMethodId: null,
              },
            },
            paygPeriods: { none: { endedAt: null } },
            // …and never bought credits (ledger-derived; same rule as
            // hasAdvertiserEverPurchasedCredits, set-based).
            ledgerEvents: { none: CREDIT_PURCHASE_LEDGER_EVENT_WHERE },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take: T.fetchBatchSize,
        });

        if (batch.length === 0) break;

        totalEligible += batch.length;
        totalQueued += await queuePromoNotificationJobsOrReturn({
          eventSlug: slug as PromoEventSlug,
          target: "ADVERTISER",
          recipientIds: batch.map((a) => a.id),
        });

        lastId = batch[batch.length - 1].id;
        if (batch.length < T.fetchBatchSize) break;
      }

      if (totalEligible > 0) {
        log.info(
          `(NUDGE_ADD_BUDGET) ${slug}: queued ${totalQueued} jobs for ${totalEligible} eligible advertisers`,
        );
      }
    }
  },
};
