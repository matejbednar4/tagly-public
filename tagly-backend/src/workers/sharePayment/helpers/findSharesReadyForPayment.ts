import prisma from "../../../prisma/prisma.js";
import { sharePaymentWorkerTunables as T } from "../../../constants/workers/SHARE_PAYMENT.js";
import {
  ADMIN_APPROVED_SHARE_WHERE,
  NO_PENDING_OR_VALID_REPORT_WHERE,
  PROCESSING_SHARE_WHERE,
} from "../../../utils/shares/shareAccess.js";
import { olderThan } from "../../helpers/olderThan.js";

/**
 * Finds shares that are ready for payment.
 *
 * A share is ready for payment when:
 * - status is PROCESSING (the payout lifecycle hasn't terminated — not PAID/UNPAYABLE)
 * - approvalStatus is APPROVED — a PENDING (unreviewed) share is never paid, and a
 *   REJECTED one is excluded. Rejection lives ONLY here now (a rejected share keeps
 *   status = PROCESSING), so this clause is the moderation gate.
 * - Both the insights row AND the snapshot row exist — these replace the old
 *   POST_SNAPSHOT status as the "data captured" signal.
 * - createdAt is at least minPaymentAgeMs old (24h) — guarantees the admin review
 *   window and a cooling-off period even for shares posted to IG long before the
 *   share was created.
 * - Has customerId (who to pay) and localId (only share type currently supported).
 * - advertiserId may be null (subsidized shares have no advertiser, but subsidization
 *   is read from share.fundingModeAtCreation in executeSharePayment, not advertiserId)
 * - No OPEN or UPHELD report: a ShareReport with status PENDING or VALID holds the
 *   share; only "no report" or a DISMISSED report is payable.
 *
 * Returns shares ordered by createdAt (oldest first - FIFO).
 */
export async function findSharesReadyForPayment() {
  const shares = await prisma.share.findMany({
    where: {
      ...PROCESSING_SHARE_WHERE,
      ...ADMIN_APPROVED_SHARE_WHERE,
      createdAt: { lte: olderThan(T.minPaymentAgeMs) },
      insights: { isNot: null },
      instagramSnapshot: { isNot: null },
      customerId: { not: null },
      localId: { not: null },
      AND: [
        // No PENDING or VALID report (both hold payment); the same rule
        // is re-checked atomically inside the settle claim (markSharePaidOrThrow).
        NO_PENDING_OR_VALID_REPORT_WHERE,
        {
          // Skip shares in settle-retry backoff — PAYG charge retries AND
          // transient settle errors on any funding mode (see executeSharePayment).
          OR: [
            { paygNextRetryAt: null },
            { paygNextRetryAt: { lte: new Date() } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: T.claimBatchSize,
    select: {
      id: true,
      uid: true,
      customerId: true,
      advertiserId: true,
      localId: true,
      createdAt: true,
      fundingModeAtCreation: true,
      paygChargeAttempts: true,
    },
  });

  return shares;
}
