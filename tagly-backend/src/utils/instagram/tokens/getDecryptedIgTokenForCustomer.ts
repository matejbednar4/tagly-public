import { TOKEN_REFRESH_BEFORE_EXPIRY_MS } from "../../../constants/instagram/INSTAGRAM.js";
import prisma from "../../../prisma/prisma.js";
import { decryptIgToken } from "./igTokenEnc.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { refreshIgLongLivedTokenOrThrow } from "./refreshIgTokenOrThrow.js";
import { saveIgTokenToDb } from "./saveIgTokenToDb.js";

/**
 * Retrieves and decrypts the Instagram access token for a customer.
 *
 * Performs token lifecycle management:
 * 1. Fetches the encrypted token from the database
 * 2. Validates the token hasn't expired
 * 3. Proactively refreshes if nearing expiry (per TOKEN_REFRESH_BEFORE_EXPIRY_MS)
 * 4. Decrypts and returns the usable access token
 *
 * All operations run in a transaction to prevent race conditions during refresh.
 *
 * @throws {CustomError} 5044 - Customer not found
 * @throws {CustomError} 5007 - No linked Instagram account
 * @throws {CustomError} 5008 - Missing token or UID
 * @throws {CustomError} 5009 - Token expired
 * @throws {CustomError} 5110 - Token refresh failed
 */
export async function getDecryptedInstagramTokenForCustomer(
  customerId: number
) {
  return prisma.$transaction(
    async (tx) => {
      const rec = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          instagram: {
            select: {
              id: true,
              instagramUid: true,
              instagramToken: {
                select: { accessTokenEnc: true, expiresAt: true },
              },
            },
          },
        },
      });

      if (!rec) {
        throw createCustomError(
          5044,
          "Couldn't find customer when getting IG AccessToken",
          404
        );
      }

      if (!rec.instagram) {
        throw createCustomError(5007, "No linked Instagram account", 400);
      }

      if (
        !rec.instagram.instagramUid ||
        !rec.instagram.id ||
        !rec.instagram.instagramToken
      ) {
        throw createCustomError(
          5008,
          "Missing Instagram access token or UID",
          400
        );
      }

      if (rec.instagram.instagramToken.expiresAt.getTime() <= Date.now()) {
        throw createCustomError(5009, "Instagram access token expired", 400);
      }

      let accessToken = decryptIgToken(
        rec.instagram.instagramToken.accessTokenEnc
      );

      const msToExpiry =
        rec.instagram.instagramToken.expiresAt.getTime() - Date.now();
      const shouldRefresh = msToExpiry <= TOKEN_REFRESH_BEFORE_EXPIRY_MS;

      if (shouldRefresh) {
        try {
          const refreshed = await refreshIgLongLivedTokenOrThrow({
            accessToken,
          });
          const newExpiresAt = new Date(
            Date.now() + refreshed.expiresIn * 1000
          );

          await saveIgTokenToDb(
            rec.instagram.id,
            refreshed.accessToken,
            newExpiresAt,
            tx
          );
          accessToken = refreshed.accessToken;
        } catch {
          throw createCustomError(
            5110,
            "Failed to refresh Instagram access token",
            502
          );
        }
      }

      return {
        instagramDbId: rec.instagram.id,
        instagramUid: rec.instagram.instagramUid,
        accessToken,
      };
    },
    { maxWait: 5000, timeout: 15000 }
  );
}
