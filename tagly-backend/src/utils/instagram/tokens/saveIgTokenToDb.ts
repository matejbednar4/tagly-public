import { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";
import { encryptIgToken } from "./igTokenEnc.js";

/**
 * Encrypts and upserts an Instagram access token for an IG account row.
 * Pass a transaction client when called inside a token-refresh transaction.
 */
export async function saveIgTokenToDb(
  instagramId: number,
  accessToken: string,
  expiresAt: Date,
  tx: Prisma.TransactionClient = prisma
) {
  const accessTokenEnc = encryptIgToken(accessToken);

  await tx.instagramToken.upsert({
    where: { instagramId },
    update: { accessTokenEnc, expiresAt },
    create: { instagramId, accessTokenEnc, expiresAt },
  });
}
