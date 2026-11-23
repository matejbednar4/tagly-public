import type {
  ShareStatus,
  ReportStatus,
  AdvertiserShareStatus,
} from "@tagly/models/shared";
import { isRejectedLikeShare } from "../../shares/shareAccess.js";

/**
 * Derive the single advertiser-facing share status from the payout `status` and
 * the share's report outcome. Twin of `deriveCustomerShareStatus`, minus the
 * intake axis: every advertiser read is already filtered to
 * `approvalStatus = APPROVED` (pending/intake-rejected shares are invisible to
 * the advertiser), so `approvalStatus` is not an input and there is no
 * UNDER_REVIEW. Precedence, highest first:
 *
 *   PAID            → "PAID"           (money is final — the advertiser paid)
 *   report VALID    → "REJECTED"       (the advertiser's report was ruled VALID;
 *                                       the customer won't be paid and the
 *                                       advertiser won't be charged)
 *   status UNPAYABLE → "UNPAYABLE"     (payout failed / voided — terminal)
 *   report PENDING  → "REPORT_REVIEW"  (the advertiser's report holds payout)
 *   else            → "PROCESSING"     (in flight)
 *
 * Neither report state is a stored `status`: a report-rejected share rests at
 * `status = PROCESSING`, so without this derive it would read "processing"
 * forever. UNPAYABLE outranks REPORT_REVIEW for the same reason as on the
 * customer side — a share can be voided while its report is still open, and a
 * terminally-dead share must read failed, not "under review".
 */
export function deriveAdvertiserShareStatus(args: {
  status: ShareStatus;
  reportStatus?: ReportStatus | null;
}): AdvertiserShareStatus {
  const { status, reportStatus } = args;
  if (status === "PAID") return "PAID";
  // Same "rejected-like" rule as the customer derive, minus the intake half
  // (advertiser rows are pre-filtered to APPROVED) — one source in shareAccess.
  if (isRejectedLikeShare({ reportStatus })) return "REJECTED";
  if (status === "UNPAYABLE") return "UNPAYABLE";
  if (reportStatus === "PENDING") return "REPORT_REVIEW";
  return "PROCESSING";
}
