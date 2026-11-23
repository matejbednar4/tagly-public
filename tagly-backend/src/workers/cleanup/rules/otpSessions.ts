import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";
import { OTP } from "../../../constants/auth/OTP.js";

/**
 * OTP sessions that are either expired long enough ago, or blocked (too many
 * attempts/resends) and have been sitting blocked for a while.
 */
export const otpSessions = {
  name: "otp sessions",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.otpSession.findMany({
          where: {
            OR: [
              // Expired long enough ago.
              { otpExpiresAt: { lt: olderThan(T.keepExpiredOtpSessionsMs) } },
              // Blocked (too many attempts/resends) and stale.
              {
                OR: [
                  { resendCount: { gte: OTP.MAX_RESENDS_PER_SESSION } },
                  { attempts: { gte: OTP.MAX_ATTEMPTS } },
                ],
                updatedAt: { lt: olderThan(T.keepBlockedOtpSessionsMs) },
              },
            ],
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (await prisma.otpSession.deleteMany({ where: { id: { in: ids } } }))
          .count,
    }),
};
