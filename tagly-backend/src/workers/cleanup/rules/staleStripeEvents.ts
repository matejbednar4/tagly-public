import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";

/**
 * Stripe webhook dedupe rows (`StripeEvent`). The table exists only so a
 * replayed webhook delivery is recognized and skipped — Stripe's own retry
 * window spans days, so `keepStripeEventsMs` (90 days) is a generous horizon.
 * Without a TTL the table grows unboundedly (it was the last unbounded table).
 * An event re-delivered after the window would merely be reprocessed, and
 * every handler is idempotent by externalRef/CAS, so late pruning is safe.
 */
export const staleStripeEvents = {
  name: "stale stripe events",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.stripeEvent.findMany({
          where: { createdAt: { lt: olderThan(T.keepStripeEventsMs) } },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (await prisma.stripeEvent.deleteMany({ where: { id: { in: ids } } }))
          .count,
    }),
};
