import type {
  ShareStatus,
  ShareApprovalStatus,
  ReportStatus,
  CustomerShareStatus,
} from "@tagly/models/shared";
import { isRejectedLikeShare } from "../../shares/shareAccess.js";

/**
 * Derive the single customer-facing share status from the three internal axes
 * (payout `status`, moderation `approvalStatus`, and the share's report outcome).
 * The customer never sees the raw axes — only this. Precedence, highest first:
 *
 *   PAID                                     → "PAID"           (money is final)
 *   approvalStatus REJECTED || report VALID  → "REJECTED"       (moderation rejected it)
 *   status UNPAYABLE                         → "UNPAYABLE"      (payout failed / voided — terminal)
 *   approvalStatus PENDING                   → "UNDER_REVIEW"   (awaiting intake review)
 *   report PENDING                           → "REPORT_REVIEW"  (advertiser report holds payout)
 *   else                                     → "PROCESSING"     (in flight)
 *
 * Neither rejection nor the report-review hold is a stored `status`: a rejected
 * share rests at `status = PROCESSING` and `REJECTED` here comes from
 * `approvalStatus` (intake reject) or a VALID `ShareReport`;
 * `REPORT_REVIEW` is derived straight off a PENDING `ShareReport` (the payout is
 * held while an admin reviews it) — the raw `status` stays PROCESSING.
 *
 * **UNPAYABLE outranks UNDER_REVIEW.** A share can be voided to `UNPAYABLE` while
 * its `approvalStatus` is still `PENDING` — the insights/snapshot workers'
 * max-attempts backstop, or a customer Instagram disconnect, flips `status`
 * without touching `approvalStatus`. That share is terminally failed and will
 * never pay, so it must read "failed" (UNPAYABLE), not "under review" (which
 * implies it might still go through). Hence the UNPAYABLE check sits above the
 * `approvalStatus PENDING` branch. A PENDING report only exists on an APPROVED
 * share, so it can't collide with the PENDING-approval branch, and it stays below
 * UNPAYABLE so a terminally-unpayable share still reads UNPAYABLE.
 */
export function deriveCustomerShareStatus(args: {
  status: ShareStatus;
  approvalStatus: ShareApprovalStatus;
  reportStatus?: ReportStatus | null;
}): CustomerShareStatus {
  const { status, approvalStatus, reportStatus } = args;
  if (status === "PAID") return "PAID";
  // The two-part "rejected-like" rule lives in shareAccess so this derivation
  // and the query-level NOT_REJECTED/dead gates can never disagree.
  if (isRejectedLikeShare({ approvalStatus, reportStatus })) return "REJECTED";
  if (status === "UNPAYABLE") return "UNPAYABLE";
  if (approvalStatus === "PENDING") return "UNDER_REVIEW";
  if (reportStatus === "PENDING") return "REPORT_REVIEW";
  return "PROCESSING";
}
