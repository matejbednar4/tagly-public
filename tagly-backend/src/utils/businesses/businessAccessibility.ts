import { sql } from "kysely";
import { VISIBILITY_BUDGETS, SUBSIDIZATION } from "@tagly/models/shared";
import type {
  BusinessAccessibilityInput,
  BusinessAccessGrant,
  BusinessBlockedReason,
} from "@tagly/models/v2/adminApp";
import { db } from "../../db/kysely.js";
import prisma from "../../prisma/prisma.js";
import { shareLiveSql } from "../shares/shareAccess.js";

/**
 * Single source of truth for business (local subaccount) **accessibility** — the
 * one rule for every reader (the
 * ledger's budget notifications consume it too).
 *
 * Visibility and shareability are ONE concept:
 * **if a business is visible, you can share it.** So there's a single rule
 * (`businessAccessibleSql`) and a single budget threshold
 * (`MIN_VISIBILITY_BUDGET_CENTS`) — never separate visibility and shareability
 * thresholds. PAYG has no spend cap — an open period + non-negative balance grants
 * access; the subsidization share-limit still gates access for subsidized businesses.
 *
 * ⚠️ Visible ≠ accessible on the wire. The customer reads that deliberately use
 * `businessVisibleSql`/`businessVisibleWhere` alone (business detail, visited
 * list, a share's embedded business) can return NON-accessible rows, so the
 * customer DTO carries the rule as `BusinessPublicPreview.isAccessible`
 * (hydrated in `hydrateBusinessPublicPreviews` via
 * `evaluateBusinessAccessibility`). Any new customer-facing earn/share
 * affordance must gate on that flag — otherwise the user walks the whole
 * create flow into createShare's 4003 after their story is already public
 * (E038).
 *
 * The SQL fragments assume the consuming query exposes these aliases:
 *   - `ls`  = `app.local_subaccounts`
 *   - `asd` = `app.advertiser_sensitive_data` (LEFT JOIN — subsidized businesses have none)
 */

/**
 * The "running low" (hot-deal / ending-soon) band: below the visibility floor
 * plus the warning margin. The ONE canonical composition of the two
 * `VISIBILITY_BUDGETS` constants. Only two rules may read it — the
 * customer-facing flag derivation `isLowBudgetEstimate`
 * (`utils/pricing/calculateEstPrice.ts`) and the advertiser-side
 * `isInLowBudgetWarningBand` below — so the pill and the "credits running low"
 * nudge can never disagree on where the band starts. Never re-derive
 * `MIN + MARGIN` or compare against this at other call sites; go through one
 * of the two predicates.
 */
export const LOW_BUDGET_THRESHOLD_CENTS = BigInt(
  VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS +
    VISIBILITY_BUDGETS.LOW_BUDGET_WARNING_MARGIN_CENTS,
);

/**
 * Advertiser-level membership in the low-budget warning band: still visible
 * via credits (at or above the floor) but below the warning threshold — the
 * state the "credits running low" nudge fires on entering. PAYG-active
 * advertisers are NEVER in the band: the card funds every share, so a low
 * credits level doesn't threaten their visibility (mirroring the customer
 * pill, whose capacity is null for PAYG/subsidized businesses). Route every
 * "is this advertiser running low?" question through this — don't recompose
 * the floor/threshold comparisons at call sites.
 */
export function isInLowBudgetWarningBand(
  availableCents: bigint,
  hasActivePaygPeriod: boolean,
): boolean {
  if (hasActivePaygPeriod) return false;
  return (
    availableCents >= BigInt(VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS) &&
    availableCents < LOW_BUDGET_THRESHOLD_CENTS
  );
}

// ─────────────────────────── SQL fragments (assume `ls` / `asd`) ───────────────────────────

/**
 * The canonical "customers may ever see this business" gate: only ACTIVE —
 * DELETED and BANNED pages are invisible to customers **by construction**, on
 * every surface. This is the single place that rule lives; never re-inline a
 * status literal in a customer-facing query. `businessAccessibleSql` composes
 * it (visibility AND funding); use `businessVisibleSql` alone for reads that
 * must show unfunded-but-existing pages (e.g. a customer's visited list), and
 * the Prisma twin `businessVisibleWhere` for `find*`-style reads.
 */
export const businessVisibleSql = sql<boolean>`ls.status = 'ACTIVE'`;

/** Prisma twin of `businessVisibleSql` — spread into a `where`. */
export const businessVisibleWhere = { status: "ACTIVE" } as const;

/**
 * The OWNER-facing twin: what an advertiser sees of their own pages. A BANNED
 * page stays visible to its owner (the page still exists — the ban is admin's
 * domain, and silently hiding it would look like data loss); only DELETED
 * disappears. Write endpoints are stricter still — edit/media/delete require
 * `status: "ACTIVE"`, so a BANNED page is view-only for its owner. Spread into
 * every advertiser-facing business `where` instead of re-inlining the literal.
 */
export const businessOwnerVisibleWhere = {
  status: { not: "DELETED" },
} as const;

/** Business currently has an open (non-ended) subsidization period. */
export const hasOpenSubsidizationPeriodSql = sql<boolean>`
  EXISTS (
    SELECT 1 FROM app.subsidization_periods sp
    WHERE sp.local_id = ls.id AND sp.ended_at IS NULL
  )
`;

/**
 * A subsidized business still has free subsidized shares left: the count of its
 * shares created during a subsidization period (excluding UNPAYABLE/REJECTED) is
 * below SUBSIDIZATION.SHARE_LIMIT. Only meaningful when subsidized — a subsidized
 * business that has used up its allowance drops out of access.
 */
export const subsidizedUnderShareLimitSql = sql<boolean>`
  (
    SELECT COUNT(s.id) FROM app.shares s
    WHERE s.local_id = ls.id
      AND ${shareLiveSql("s")}
      AND EXISTS (
        SELECT 1 FROM app.subsidization_periods sp2
        WHERE sp2.local_id = ls.id
          AND sp2.started_at <= s.created_at
          AND (sp2.ended_at IS NULL OR sp2.ended_at >= s.created_at)
      )
  ) < ${SUBSIDIZATION.SHARE_LIMIT}
`;

/** Business's advertiser is on pay-as-you-go (an open, non-ended PaygPeriod). */
export const hasActivePaygPeriodSql = sql<boolean>`
  EXISTS (
    SELECT 1 FROM app.payg_periods pp
    WHERE pp.advertiser_id = ls.advertiser_id AND pp.ended_at IS NULL
  )
`;

/**
 * Business is **accessible** (visible == shareable): ACTIVE, the advertiser's
 * balance is not negative, and **any one** of —
 *   1) credits:     advertiser AVAILABLE budget >= MIN_VISIBILITY_BUDGET_CENTS
 *   2) subsidized:  open subsidization period AND fewer than SUBSIDIZATION.SHARE_LIMIT
 *                   in-progress/paid subsidized shares (UNPAYABLE/REJECTED don't count)
 *   3) PAYG:        open PAYG period (no spend cap — the card funds every share;
 *                   the advertiser stops by unlinking it)
 *
 * The **negative-balance gate is absolute**: a below-zero balance is an
 * uncollectable PAYG receivable (a settlement paid the customer while the card
 * had been removed/declining), so the business stays hidden — even with an
 * open PAYG period — until credits cover the debt. (Subsidized businesses have
 * no advertiser row; the LEFT-JOINed `asd` coalesces to 0, which passes.)
 */
export const businessAccessibleSql = sql<boolean>`
  ${businessVisibleSql}
  -- negative balance = unpaid PAYG debt; hides the business outright
  AND COALESCE(asd.available_budget_usd_cents, 0) >= 0
  AND (
    -- 1) enough purchased credits available
    COALESCE(asd.available_budget_usd_cents, 0) >= ${VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS}
    -- 2) subsidized with subsidized-share allowance left
    OR (${hasOpenSubsidizationPeriodSql} AND ${subsidizedUnderShareLimitSql})
    -- 3) on PAYG (card funds every share; no spend cap)
    OR ${hasActivePaygPeriodSql}
  )
`;

// ─────────────────────────── Query helpers ───────────────────────────

/**
 * Applies `businessAccessibleSql` as a `WHERE` clause. The query must expose the
 * `ls` (`app.local_subaccounts`) and LEFT-JOINed `asd`
 * (`app.advertiser_sensitive_data`) aliases.
 */
export function applyBusinessAccessibleFilter<T>(q: T): T {
  return (q as any).where(businessAccessibleSql) as T;
}

/**
 * Per-business `isSubsidizedByPlatform` for a batch of ids, in one query. The
 * rule itself lives above (`hasOpenSubsidizationPeriodSql`); this just selects it.
 */
export async function getBusinessSubsidizedStatuses(
  businessIds: number[],
): Promise<Map<number, boolean>> {
  if (businessIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("app.local_subaccounts as ls")
    .select(["ls.id", hasOpenSubsidizationPeriodSql.as("is_subsidized")])
    .where("ls.id", "in", businessIds)
    .execute();

  return new Map(rows.map((r) => [r.id, r.is_subsidized]));
}

/**
 * Per-business advertiser id for a batch of business ids, in one query. Null for
 * a subsidized business (no advertiser row). Mirrors `getBusinessSubsidizedStatuses`.
 * Used by the reward-estimate cache to resolve each business's advertiser so the
 * advertiser budget generation can be embedded in the cache key (a null advertiser
 * uses the sentinel gen 0 — subsidized estimates are never budget-capped anyway).
 */
export async function getBusinessAdvertiserIds(
  businessIds: number[],
): Promise<Map<number, number | null>> {
  if (businessIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("app.local_subaccounts as ls")
    .select(["ls.id", "ls.advertiser_id as advertiserId"])
    .where("ls.id", "in", businessIds)
    .execute();

  return new Map(rows.map((r) => [r.id, r.advertiserId]));
}

/**
 * Per-business budget capacity for a batch of business ids, in one query — the
 * inputs the pricer needs to cap a credits-only estimate at what the budget can
 * fund: `{ advertiserId, availableBudgetUsdCents, hasActivePaygPeriod }`. Mirrors
 * `getBusinessSubsidizedStatuses`. A subsidized/no-advertiser business coalesces
 * to `available = 0` + `hasActivePaygPeriod = false`; the pricer exempts
 * subsidized/PAYG from capping BEFORE reading `available`, so that 0 never zeroes
 * a subsidized estimate.
 */
export async function getBusinessBudgetCapacities(
  businessIds: number[],
): Promise<
  Map<
    number,
    {
      advertiserId: number | null;
      availableBudgetUsdCents: bigint;
      hasActivePaygPeriod: boolean;
    }
  >
> {
  if (businessIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("app.local_subaccounts as ls")
    .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
    .leftJoin(
      "app.advertiser_sensitive_data as asd",
      "asd.id",
      "a.sensitive_data_id",
    )
    .select([
      "ls.id",
      "ls.advertiser_id as advertiserId",
      sql<string>`COALESCE(asd.available_budget_usd_cents, 0)`.as("available"),
      hasActivePaygPeriodSql.as("hasActivePaygPeriod"),
    ])
    .where("ls.id", "in", businessIds)
    .execute();

  return new Map(
    rows.map((r) => [
      r.id,
      {
        advertiserId: r.advertiserId,
        // Int8 columns select as strings — widen to bigint for cent math.
        availableBudgetUsdCents: BigInt(r.available),
        hasActivePaygPeriod: r.hasActivePaygPeriod,
      },
    ]),
  );
}

/**
 * Whether the advertiser is currently **visible** to customers — at least one of
 * their business pages satisfies `businessAccessibleSql` (enough available
 * credit, an active PAYG period, or an in-allowance subsidization).
 *
 * This is the account-level roll-up of per-business accessibility, used by the
 * advertiser's home to distinguish a lapsed-but-funded account ("top up credits
 * or fix PAYG") from a never-activated one. Returns false when the advertiser has
 * no business pages (nothing to be visible). Reuses the single accessibility rule
 * — do not re-derive the thresholds here.
 */
export async function isAdvertiserVisible(
  advertiserId: number,
): Promise<boolean> {
  const row = await applyBusinessAccessibleFilter(
    db
      .selectFrom("app.local_subaccounts as ls")
      .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
      .leftJoin(
        "app.advertiser_sensitive_data as asd",
        "asd.id",
        "a.sensitive_data_id",
      )
      .select("ls.id")
      .where("ls.advertiser_id", "=", advertiserId)
      .limit(1),
  ).executeTakeFirst();
  return row != null;
}

/**
 * Whether the advertiser is currently on PAYG — has an open (non-ended)
 * `PaygPeriod`. Periods are always created with `startedAt = now()`, so "open" ===
 * "active". The JS mirror of `hasActivePaygPeriodSql` (which gates by `ls`); use this
 * when you only have an `advertiserId` in hand (e.g. the ledger's budget
 * notifications), not a business row + `asd` join.
 */
export async function hasActiveAdvertiserPaygPeriod(
  advertiserId: number,
): Promise<boolean> {
  const period = await prisma.paygPeriod.findFirst({
    where: { advertiserId, endedAt: null },
    select: { id: true },
  });
  return period !== null;
}

// ─────────────────────────── Admin accessibility breakdown ───────────────────────────

/**
 * Count of a business's shares created during a subsidization period, excluding
 * only terminal/rejected rows — the numerator of the subsidized share-limit gate.
 * Same predicate as `subsidizedUnderShareLimitSql`, but returns the count (for
 * the admin `facts` block) rather than the `< SHARE_LIMIT` boolean.
 */
const subsidizedShareCountSql = sql<number>`
  (
    SELECT COUNT(s.id) FROM app.shares s
    WHERE s.local_id = ls.id
      AND ${shareLiveSql("s")}
      AND EXISTS (
        SELECT 1 FROM app.subsidization_periods sp2
        WHERE sp2.local_id = ls.id
          AND sp2.started_at <= s.created_at
          AND (sp2.ended_at IS NULL OR sp2.ended_at >= s.created_at)
      )
  )::int
`;

/**
 * The structured **why** behind `businessAccessibleSql`, for the admin surface:
 * whether customers can currently see each business, the single funding path
 * that grants it (or every reason it's blocked), plus the raw facts the rule
 * read. Same thresholds and predicate as `businessAccessibleSql` — this is the
 * rule exposed as data, never a re-derivation.
 *
 * Batched (mirrors `getBusinessBudgetCapacities`): one query over `ls` +
 * LEFT-JOINed advertiser/`asd`. Returns a Map keyed by local id; ids with no row
 * (deleted mid-flight) are simply absent.
 */
export async function evaluateBusinessAccessibility(
  localIds: number[],
): Promise<Map<number, BusinessAccessibilityInput>> {
  if (localIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("app.local_subaccounts as ls")
    .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
    .leftJoin(
      "app.advertiser_sensitive_data as asd",
      "asd.id",
      "a.sensitive_data_id",
    )
    .select([
      "ls.id",
      "ls.status",
      sql<string>`COALESCE(asd.available_budget_usd_cents, 0)`.as("available"),
      hasOpenSubsidizationPeriodSql.as("hasOpenSub"),
      hasActivePaygPeriodSql.as("hasPayg"),
      subsidizedShareCountSql.as("subCount"),
    ])
    .where("ls.id", "in", localIds)
    .execute();

  const MIN = VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS;
  const LIMIT = SUBSIDIZATION.SHARE_LIMIT;

  return new Map(
    rows.map((r) => {
      // Int8 columns select as strings — widen to bigint for cent math.
      const available = BigInt(r.available);
      const status = r.status;
      const hasOpenSub = r.hasOpenSub;
      const hasPayg = r.hasPayg;
      const subCount = r.subCount ?? 0;

      const creditsOk = available >= BigInt(MIN);
      const subsidizedOk = hasOpenSub && subCount < LIMIT;
      const fundingOk = creditsOk || subsidizedOk || hasPayg;
      const isAccessible =
        status === "ACTIVE" && available >= 0n && fundingOk;

      let grantedBy: BusinessAccessGrant | null = null;
      if (isAccessible) {
        grantedBy = creditsOk ? "CREDITS" : subsidizedOk ? "SUBSIDIZED" : "PAYG";
      }

      const blockedReasons: BusinessBlockedReason[] = [];
      if (!isAccessible) {
        if (status !== "ACTIVE") blockedReasons.push("NOT_ACTIVE");
        if (available < 0n) blockedReasons.push("NEGATIVE_BALANCE");
        // Funding failures only matter once the absolute gates pass.
        if (status === "ACTIVE" && available >= 0n && !fundingOk) {
          if (!creditsOk) blockedReasons.push("INSUFFICIENT_CREDITS");
          if (hasOpenSub && subCount >= LIMIT) {
            blockedReasons.push("SUBSIDIZATION_EXHAUSTED");
          } else if (!hasOpenSub) {
            blockedReasons.push("NOT_SUBSIDIZED");
          }
          if (!hasPayg) blockedReasons.push("NO_ACTIVE_PAYG");
        }
      }

      return [
        r.id,
        {
          isAccessible,
          grantedBy,
          blockedReasons,
          facts: {
            status,
            availableBudgetCents: available,
            minVisibilityBudgetCents: MIN,
            hasOpenSubsidizationPeriod: hasOpenSub,
            subsidizedShareCount: subCount,
            subsidizationShareLimit: LIMIT,
            hasActivePaygPeriod: hasPayg,
          },
        },
      ];
    }),
  );
}
