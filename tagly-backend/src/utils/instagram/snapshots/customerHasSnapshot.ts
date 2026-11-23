import prisma from "../../../prisma/prisma.js";

/**
 * Canonical "does this customer have an Instagram audience snapshot yet?" check —
 * the single definition shared by every reader so the reward estimate, the
 * per-business "soon" state, and `CustomerMe.instagram.hasSnapshot` can never
 * disagree.
 *
 * "Has a snapshot" == at least one `InstagramSnapshot` row exists for the
 * customer's linked IG account. This is exactly the existence check
 * `calculateEstPrice` gates its `NO_SNAPSHOT` branch on (and the value
 * `refreshInstagram` reports as `alreadyHadSnapshot`), so all of them flip in
 * lockstep the instant the IG snapshot worker writes the latest snapshot row.
 * Always derived on read — never denormalized — so it can't drift behind the
 * worker.
 */
export async function customerHasSnapshot(customerId: number): Promise<boolean> {
  const snapshot = await prisma.instagramSnapshot.findFirst({
    where: { instagram: { customerId } },
    select: { id: true },
  });
  return snapshot !== null;
}
