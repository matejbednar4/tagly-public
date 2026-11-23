import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";

/**
 * Abandoned registrations: PendingCustomer / PendingAdvertiserAccount rows
 * whose signup was never completed. Completion deletes the pending row, so any
 * row older than the retention window is an abandoned signup holding personal
 * data (email, name, gender, interests, consent stamps) with no account —
 * privacy retention policy says these live at most `keepAbandonedSignupsMs`
 * (30 days).
 *
 * OtpSession / PushToken / OAuthIdentity / PromoNotificationLog rows cascade
 * with the pending row. CustomerInstagramAccount.pendingCustomerId is SetNull
 * (an IG account connected mid-registration), so those rows — and their
 * encrypted tokens/snapshots, via cascade — are deleted explicitly first to
 * avoid orphans.
 */
export const abandonedPendingSignups = {
  name: "abandoned pending signups",
  run: async () => {
    const customers = await deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.pendingCustomer.findMany({
          where: { createdAt: { lt: olderThan(T.keepAbandonedSignupsMs) } },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) => {
        await prisma.customerInstagramAccount.deleteMany({
          where: { pendingCustomerId: { in: ids } },
        });
        return (
          await prisma.pendingCustomer.deleteMany({
            where: { id: { in: ids } },
          })
        ).count;
      },
    });

    const advertisers = await deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.pendingAdvertiserAccount.findMany({
          where: { createdAt: { lt: olderThan(T.keepAbandonedSignupsMs) } },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (
          await prisma.pendingAdvertiserAccount.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    });

    return customers + advertisers;
  },
};
