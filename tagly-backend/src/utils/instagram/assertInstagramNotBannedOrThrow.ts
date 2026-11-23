import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { ERROR_CODES } from "@tagly/models/shared";

/**
 * Throws if the given Instagram account is on the persistent ban-list
 * (BannedInstagram). Call this wherever an Instagram account is
 * assigned/reassigned to a Tagly account — new-account registration and
 * connect/reconnect — so a banned customer cannot re-use the same Instagram
 * (e.g. by deleting their account and registering again).
 *
 * Pass a transaction client when calling from inside a `$transaction` so the
 * read participates in the same transaction; defaults to the global client.
 *
 * @throws 1541 (403) if the Instagram account is banned.
 */
export async function assertInstagramNotBannedOrThrow(
  instagramUid: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const banned = await client.bannedInstagram.findUnique({
    where: { instagramUid },
    select: { id: true },
  });

  if (banned) {
    throw createCustomError(
      ERROR_CODES.DOMAIN.INSTAGRAM_BANNED,
      "This Instagram account is banned",
      403
    );
  }
}
