import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";

/**
 * Canonical "latest Instagram snapshot for a customer" query — the single
 * definition of *which* snapshot is newest, shared by every reader (the est
 * pricers, the Discover audience map, …) so they can never disagree on ordering.
 *
 * Newest = highest `snapshotTakenAt` (the logical capture time the worker
 * stamps), with `id` as a deterministic tiebreaker for same-instant rows. The
 * scope is account-level by customer, and a **share-level snapshot counts** — a
 * snapshot is a snapshot; the freshest audience data wins regardless of what
 * enqueued it (there is deliberately no `shareId` filter).
 *
 * Pass the `select` your caller needs; the return type is inferred from it.
 * Returns `null` when the customer has no snapshot yet — the same existence
 * signal as [[customer-has-snapshot]].
 */
export function getLatestSnapshot<T extends Prisma.InstagramSnapshotSelect>(
  customerId: number,
  select: T,
): Promise<Prisma.InstagramSnapshotGetPayload<{ select: T }> | null> {
  return prisma.instagramSnapshot.findFirst({
    where: { instagram: { customerId } },
    orderBy: [{ snapshotTakenAt: "desc" }, { id: "desc" }],
    select,
  }) as Promise<Prisma.InstagramSnapshotGetPayload<{ select: T }> | null>;
}
