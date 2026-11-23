import prisma from "../../prisma/prisma.js";
import { Prisma, LinkStatus } from "../../generated/prisma/client.js";
import { checkUrlSafety } from "./checkUrlSafety.js";

/**
 * Find or create the shared, de-duplicated `Link` for a URL and return its id +
 * status. A **brand-new** link is screened by Google Safe Browsing: flagged →
 * `REJECTED`, otherwise `PENDING` (an admin approves before it's shown). An
 * **existing** link is reused as-is — including a prior `REJECTED` (the
 * cross-business kill-switch) — so a previously-approved URL is instantly live.
 * A new link is never `APPROVED` automatically.
 *
 * Must run OUTSIDE a DB transaction: it makes a network call to Safe Browsing.
 * The caller links the returned id onto the business (e.g. `websiteLinkId`).
 *
 * URLs are matched by exact (trimmed) string — the write boundary validates the
 * URL shape; richer canonicalization can be added to the dedup later.
 */
export async function upsertLink(
  rawUrl: string,
): Promise<{ id: number; status: LinkStatus }> {
  const url = rawUrl.trim();

  const existing = await prisma.link.findUnique({
    where: { url },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  const safety = await checkUrlSafety(url);
  const status =
    safety === "unsafe" ? LinkStatus.REJECTED : LinkStatus.PENDING;

  try {
    return await prisma.link.create({
      data: {
        url,
        status,
        reviewedAt: status === LinkStatus.REJECTED ? new Date() : null,
      },
      select: { id: true, status: true },
    });
  } catch (e) {
    // Concurrent create of the same url → reuse the row that won the race.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const found = await prisma.link.findUnique({
        where: { url },
        select: { id: true, status: true },
      });
      if (found) return found;
    }
    throw e;
  }
}
