import { sql, type RawBuilder } from "kysely";
import type {
  ShareApprovalStatus,
  ShareStatus,
  ReportStatus,
} from "@tagly/models/shared";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Single source of truth for **share access/visibility predicates** — the share
 * twin of `utils/businesses/businessAccessibility.ts`. Every rule
 * about which shares an audience sees, which are live, which an admin can act
 * on, and which the payment worker may settle lives HERE, in one named form
 * per shape (Prisma `where` fragment · Kysely/SQL fragment · in-memory
 * predicate). Never re-inline a share-axis literal in a query — compose these.
 *
 * The axes (see docs/SHARE_LIFECYCLE.md):
 *   - payout `status`        PROCESSING → PAID / UNPAYABLE
 *   - moderation `approvalStatus`  PENDING → APPROVED / REJECTED
 *   - report `report.status` PENDING → VALID / DISMISSED
 *   - assessment `ratedAt`   null ⟺ never rated AND never reported
 *
 * **"Rejected" is a two-part concept** (mirrors `deriveCustomerShareStatus`):
 * a share is rejected-like when the admin intake-rejected it (`approvalStatus
 * = REJECTED`) OR a VALID report killed it post-approval (the
 * admin confirmed the advertiser's report). `NOT_REJECTED_SHARE_WHERE` / `LIVE_SHARE_WHERE` / `shareDeadSql`
 * all honor both parts — a report-killed share stops counting toward caps,
 * stats, and purge guards exactly like an intake-rejected one.
 *
 * Audience rules at a glance:
 *   - CUSTOMER: sees ALL their own shares, deliberately unfiltered — their
 *     PENDING/REJECTED shares render via the derived `CustomerShareStatus`.
 *     There is intentionally no predicate for this (ownership is the filter).
 *   - ADVERTISER: sees only admin-approved shares (`ADMIN_APPROVED_SHARE_*`).
 *   - ADMIN: sees everything; the queue predicates below narrow to what needs
 *     action.
 *   - PLATFORM STATISTICS: count "created" shares with the looser
 *     `NOT_REJECTED_SHARE_WHERE` gate (PENDING still counts as created) —
 *     deliberately NOT the advertiser gate.
 *
 * NAMING RULE: predicate names use the enum values VERBATIM (`APPROVED`,
 * `REJECTED`, `PENDING`, `VALID`, `DISMISSED`, `PAID`) plus the acting party
 * where one exists (`ADMIN_APPROVED`, `PENDING_ADMIN_APPROVAL`). No coined
 * synonyms — the two sanctioned exceptions are LIVE/DEAD (because
 * "VALID share" would collide with the opposite-meaning VALID report) and
 * UNASSESSED (the product's own term for the once-only rate-or-report action).
 *
 * SQL fragments take the share table's alias (default `"s"`); pass `""` when
 * the query addresses `app.shares` unaliased (column refs then use the bare
 * `shares` relation name).
 *
 * The workers (payment, maintenance, cleanup)
 * and the permanent business-accessibility rule consume these too — the axes'
 * meaning is invariant across client versions.
 */

const aliasPrefix = (alias: string) => (alias ? `${alias}.` : "");
// Row reference for correlated subqueries: `<alias>.id`, or the bare relation
// name when the outer query addresses `app.shares` unaliased.
const shareIdRef = (alias: string) => (alias ? `${alias}.id` : "shares.id");

// ShareReport's FK column is unmapped camelCase — quote it in raw SQL.
const validReportExistsSql = (alias: string) => sql<boolean>`EXISTS (
    SELECT 1 FROM app.share_reports sr
    WHERE sr."shareId" = ${sql.raw(shareIdRef(alias))} AND sr.status = 'VALID'
  )`;

// ─────────────────── Advertiser-visible (admin approval gate) ───────────────────

/**
 * The advertiser-visible gate: a share is only in the advertiser's world (and
 * in advertiser-facing statistics) once an ADMIN has approved it at intake.
 * New shares are PENDING (fully hidden); intake-rejected shares are gone.
 */
export const ADMIN_APPROVED_SHARE_WHERE = {
  approvalStatus: "APPROVED",
} as const satisfies { approvalStatus: ShareApprovalStatus };

/** The gate's status value for Kysely `.where("<alias>.approval_status", "=", …)`. */
export const ADMIN_APPROVED_SHARE_STATUS =
  ADMIN_APPROVED_SHARE_WHERE.approvalStatus;

export function isAdminApprovedShare<
  T extends { approvalStatus: ShareApprovalStatus },
>(share: T): boolean {
  return share.approvalStatus === "APPROVED";
}

export function filterAdminApprovedShares<
  T extends { approvalStatus: ShareApprovalStatus },
>(shares: T[]): T[] {
  return shares.filter(isAdminApprovedShare);
}

// ─────────────────── Assessment (rated/reported) gate ───────────────────

/**
 * The canonical "never assessed" gate, built on the schema invariant on
 * `Share.ratedAt`: it is stamped the moment a share is first RATED **or**
 * REPORTED and then preserved forever, so `ratedAt IS NULL` ⟺ unrated AND
 * unreported. Every "unrated / rate-me" queue (advertiser + admin) and every
 * once-only assessment guard filters on this — never on `rating` alone (a
 * reported share has `rating = null` but was acted on).
 */
export const UNASSESSED_SHARE_WHERE = { ratedAt: null } as const;

/** In-memory twin of {@link UNASSESSED_SHARE_WHERE} for already-fetched rows. */
export function isUnassessedShare(row: { ratedAt: Date | null }): boolean {
  return row.ratedAt === null;
}

// ─────────────────── Platform-wide "created" gate ───────────────────

/**
 * The looser platform-statistics gate: a share COUNTS AS CREATED unless
 * moderation killed it — intake-rejected OR killed by a VALID
 * report. PENDING still counts (it exists, it's just unreviewed). This is
 * deliberately NOT the advertiser-visible gate; picking the wrong one
 * silently skews platform metrics.
 */
export const NOT_REJECTED_SHARE_WHERE = {
  approvalStatus: { not: "REJECTED" },
  NOT: { report: { is: { status: "VALID" } } },
} as const satisfies Prisma.ShareWhereInput;

/** SQL twin of {@link NOT_REJECTED_SHARE_WHERE}. */
export function shareNotRejectedSql(alias = "s"): RawBuilder<boolean> {
  const p = sql.raw(aliasPrefix(alias));
  return sql<boolean>`(${p}approval_status != 'REJECTED' AND NOT ${validReportExistsSql(alias)})`;
}

/**
 * In-memory form of the "rejected-like" rule that {@link NOT_REJECTED_SHARE_WHERE}
 * negates and {@link shareDeadSql} folds into DEAD: a share is rejected-like when
 * the admin intake-rejected it (`approvalStatus = REJECTED`) OR a VALID report
 * killed it post-approval. This is the SINGLE source of that two-part rule for
 * already-fetched rows — the `derive*ShareStatus` functions compose it, so the
 * customer/advertiser-facing status can never disagree with the query-level gate
 * (when the rule gained the report-VALID half, unifying here would have been the
 * ONE edit instead of four kept-in-sync-by-hand). Pass only the axes you have:
 * an advertiser row is pre-filtered to APPROVED, so it passes `reportStatus`
 * alone and the approval half is correctly never true.
 */
export function isRejectedLikeShare(args: {
  approvalStatus?: ShareApprovalStatus;
  reportStatus?: ReportStatus | null;
}): boolean {
  return args.approvalStatus === "REJECTED" || args.reportStatus === "VALID";
}

// ─────────────────── Live vs dead shares ───────────────────

/**
 * A LIVE share — still in play, counts toward caps/limits/dedupe: not voided
 * (UNPAYABLE), not killed by a VALID report, not intake-rejected. Used by
 * the subsidized share-limit, the per-day share dedupe, and the customer's
 * shared-verticals derivation. ("VALID_SHARE" was deliberately avoided — a
 * VALID *report* means the share was killed, the exact opposite.)
 */
export const LIVE_SHARE_WHERE = {
  status: { not: "UNPAYABLE" },
  ...NOT_REJECTED_SHARE_WHERE,
} as const satisfies Prisma.ShareWhereInput;

/** SQL twin of {@link LIVE_SHARE_WHERE}. */
export function shareLiveSql(alias = "s"): RawBuilder<boolean> {
  const p = sql.raw(aliasPrefix(alias));
  return sql<boolean>`(${p}status != 'UNPAYABLE' AND ${shareNotRejectedSql(alias)})`;
}

/**
 * The De-Morgan inverse of {@link shareLiveSql}: a DEAD share (voided,
 * intake-rejected, or report-killed) — the maintenance stuck-budget recovery
 * scans these for locks that were never released.
 */
export function shareDeadSql(alias = "s"): RawBuilder<boolean> {
  const p = sql.raw(aliasPrefix(alias));
  return sql<boolean>`(${p}status = 'UNPAYABLE' OR ${p}approval_status = 'REJECTED' OR ${validReportExistsSql(alias)})`;
}

// ─────────────────── Admin moderation queues ───────────────────

/**
 * A share awaiting the admin's intake approval AND still decidable: PENDING
 * approval while the payout is still in flight. The PROCESSING half is
 * load-bearing — a share voided to UNPAYABLE while pending must never be
 * approvable (the lock placed at approval could then never be settled or
 * released → trapped funds). Used verbatim as the approve/reject CAS guard so
 * the queue and the mutations can never disagree.
 */
export const PENDING_ADMIN_APPROVAL_WHERE = {
  approvalStatus: "PENDING",
  status: "PROCESSING",
} as const satisfies {
  approvalStatus: ShareApprovalStatus;
  status: ShareStatus;
};

/** The approval QUEUE filter: decidable + has a customer to pay/notify. */
export const PENDING_ADMIN_APPROVAL_QUEUE_WHERE = {
  ...PENDING_ADMIN_APPROVAL_WHERE,
  customerId: { not: null },
} as const;

/**
 * The shared "assessable" base — a share that can still be rated/reported:
 * admin-approved (in the rated world) + never assessed + **has a customer**.
 * The customer clause is load-bearing: an assessment moves the customer's
 * multiplier (rating) or files a report against them, so a customerless share
 * (customer deleted → `customerId` SetNull, and such shares are also UNPAYABLE
 * with tombstoned media) is deliberately NOT assessable — there's no one to
 * rate and nothing to judge. Each audience adds ONE axis:
 *   - ADVERTISER → owns the share (the `advertiserId` filter, applied by the caller)
 *   - ADMIN      → SUBSIDIZED only (no advertiser exists to do it)
 * Deliberately NOT filtered by payout `status`: rating measures post quality,
 * worth recording even on a PAID share (feeds future rewards).
 */
const ASSESSABLE_BASE_WHERE = {
  ...ADMIN_APPROVED_SHARE_WHERE,
  ...UNASSESSED_SHARE_WHERE,
  customerId: { not: null },
} as const;

/**
 * A share the ADVERTISER can assess: the base (approved + unassessed + has a
 * customer). The `advertiserId` ownership filter is the caller's audience scope
 * (advertiser shares are their own, hence non-subsidized) — compose it in.
 * `isAdvertiserAssessableShare` is the in-memory twin (the `shouldAssessShare`
 * DTO flag) and the advertiser assessment mutation's guard.
 */
export const ADVERTISER_ASSESSABLE_SHARE_WHERE = ASSESSABLE_BASE_WHERE;

/**
 * A share the ADMIN can rate/report in the missing advertiser's stead: the base
 * + SUBSIDIZED (the admin-only axis — subsidized businesses have no advertiser).
 * `isAdminAssessableShare` is the in-memory twin.
 */
export const ADMIN_ASSESSABLE_SHARE_WHERE = {
  ...ASSESSABLE_BASE_WHERE,
  fundingModeAtCreation: "SUBSIDIZED",
} as const;

/**
 * In-memory twin of {@link ADVERTISER_ASSESSABLE_SHARE_WHERE} (minus the
 * `advertiserId` ownership scope, which the caller owns) — the single source for
 * the advertiser `shouldAssessShare` DTO flag AND the mutation guard, so the
 * unrated queue, the detail flag, and the write can never disagree.
 */
export function isAdvertiserAssessableShare(row: {
  approvalStatus: ShareApprovalStatus;
  ratedAt: Date | null;
  customerId: number | null;
}): boolean {
  return (
    isAdminApprovedShare(row) &&
    isUnassessedShare(row) &&
    row.customerId !== null
  );
}

/** In-memory twin of {@link ADMIN_ASSESSABLE_SHARE_WHERE} — the admin `shouldAssessShare` flag. */
export function isAdminAssessableShare(row: {
  approvalStatus: ShareApprovalStatus;
  fundingModeAtCreation: string;
  ratedAt: Date | null;
  customerId: number | null;
}): boolean {
  return (
    isAdvertiserAssessableShare(row) &&
    row.fundingModeAtCreation === "SUBSIDIZED"
  );
}

// ─────────────────── Report axis ───────────────────

/** A report awaiting a verdict (`ShareReport` model shape — counts, queues). */
export const PENDING_REPORT_WHERE = {
  status: "PENDING",
} as const satisfies { status: ReportStatus };

/** Share-side twin of {@link PENDING_REPORT_WHERE} (`Share` model shape). */
export const SHARE_HAS_PENDING_REPORT_WHERE = {
  report: PENDING_REPORT_WHERE,
} as const;

/**
 * The report side of the payment-ready gate: NO report at all, or a DISMISSED
 * one. A PENDING report blocks the payout until the verdict; a VALID one
 * blocks it forever (the share is rejected-like). NOT named
 * "DISMISSED_REPORT_WHERE" — most shares have no report and must still pass.
 * Kept as an explicit OR (not `isNot`) so the payment gate never depends on
 * Prisma's nullable-relation negation semantics. `isPendingOrValidReport` is
 * the in-tx re-check twin (`markSharePaidOrThrow`) so the worker's scan and
 * the atomic claim can never disagree.
 */
export const NO_PENDING_OR_VALID_REPORT_WHERE: Prisma.ShareWhereInput = {
  OR: [{ report: { is: null } }, { report: { status: "DISMISSED" } }],
};

/** In-memory twin of {@link NO_PENDING_OR_VALID_REPORT_WHERE} (true = payout blocked). */
export function isPendingOrValidReport(
  report: { status: ReportStatus } | null,
): boolean {
  return report !== null && report.status !== "DISMISSED";
}

// ─────────────────── In-flight (PROCESSING) gate ───────────────────

/**
 * An IN-FLIGHT share — payout lifecycle not yet terminal (`status =
 * PROCESSING`, i.e. not PAID and not UNPAYABLE). This is the set the void
 * paths select (IG disconnect / Meta data-deletion), the deleted-business
 * purge guard checks for, and the payment worker's candidate scan starts
 * from. NOTE: `status` alone is NOT the moderation axis — a PROCESSING share
 * can still be intake-rejected or hold a VALID report (both keep `status =
 * PROCESSING`); combine with the approval/report predicates when you need the
 * full gate.
 */
export const PROCESSING_SHARE_WHERE = {
  status: "PROCESSING",
} as const satisfies { status: ShareStatus };

/** In-memory twin of {@link PROCESSING_SHARE_WHERE}. */
export function isProcessingShare(row: { status: ShareStatus }): boolean {
  return row.status === "PROCESSING";
}

// ─────────────────── Paid (money final) gate ───────────────────

/** The "money is final" gate for earnings/statistics reads. */
export const PAID_SHARE_WHERE = {
  status: "PAID",
} as const satisfies { status: ShareStatus };

/** SQL twin of {@link PAID_SHARE_WHERE} for aggregate `FILTER (WHERE …)` clauses. */
export function sharePaidSql(alias = "s"): RawBuilder<boolean> {
  return sql<boolean>`${sql.raw(aliasPrefix(alias))}status = 'PAID'`;
}
