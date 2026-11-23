import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import { Prisma } from "../../../../../generated/prisma/client.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import { exchangeIGCodeForToken } from "../../../../../utils/instagram/tokens/exchangeIGCodeForToken.js";
import { getUserDataFromIG } from "../../../../../utils/instagram/accountInsights/getUserDataFromIg.js";
import { getAndEncryptIgLongLivedToken } from "../../../../../utils/instagram/tokens/getAndEncryptIgLLT.js";
import { getDecryptedInstagramTokenForCustomer } from "../../../../../utils/instagram/tokens/getDecryptedIgTokenForCustomer.js";
import { checkUserInstagramPermission } from "../../../../../utils/instagram/permission/checkUserInstagramPermission.js";
import { customerHasSnapshot } from "../../../../../utils/instagram/snapshots/customerHasSnapshot.js";
import { assertInstagramNotBannedOrThrow } from "../../../../../utils/instagram/assertInstagramNotBannedOrThrow.js";
import type { ConnectInstagramBody } from "@tagly/models/v2/customerApp";
import type { ConnectInstagramResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/instagram/connect` — link or re-authorize the logged-in
 * customer's Instagram (the in-app counterpart to onboarding's IG login). The
 * frontend runs the IG OAuth flow and hands us the resulting `code`.
 *
 * Handles two scenarios off the one code:
 *  A) **First-time link** (no IG row yet — onboarded without Instagram): connects
 *     a new account, rejecting one already tied to another Tagly account (2214).
 *  B) **Re-authorization** (recover DISCONNECTED / EXPIRED_TOKEN, or grant the
 *     insights permission): refreshes the stored token + profile, requiring the
 *     same IG account so a user can't silently switch logins (4101).
 *
 * Flow:
 * 1. Exchange the OAuth code for a short-lived token.
 * 2. Fetch IG user data to get the account's IG uid + fresh profile.
 * 3. Assert the IG uid isn't banned (every connect — link, reconnect, re-auth),
 *    then validate ownership: first-timers must not collide with another account;
 *    re-auth must match the currently-linked IG uid.
 * 4. Exchange short-lived → long-lived token (encrypted).
 * 5. Create the IG account row (with nested token) or refresh the existing one.
 * 6. Re-verify the granted permission — surfaces MISSING_PERMISSION (4099) when
 *    the insights scope wasn't granted.
 *
 * Returns the refreshed profile; a 200 means CONNECTED. The client then re-probes
 * via `/instagram/refresh` to queue an audience snapshot.
 */
export const connectInstagram: RequestHandler = asyncHandler(
  async (req, res) => {
    const { code } = req.validatedBody as ConnectInstagramBody;
    const customerId = req.user.id;

    // 1) Exchange code → short-lived token.
    const shortLivedToken = await exchangeIGCodeForToken(code);

    // 2) Fetch IG user data (uid + profile).
    const userData = await getUserDataFromIG(shortLivedToken);

    // 3) Ensure this IG account belongs to the logged-in customer.
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        instagram: { select: { id: true, instagramUid: true } },
      },
    });
    if (!customer) {
      throw createCustomError(5044, "Customer not found", 404);
    }

    // No linked IG row at all = this is the first connection.
    const isFirstTimeConnection = customer.instagram === null;

    // The IG account must not be block-listed — assert on EVERY connect (first-time
    // link, post-disconnect reconnect, and same-uid re-auth alike). Cheap uid
    // lookup; a banned uid throws 1541.
    // This is what stops disconnect from being used to (re)attach a banned
    // Instagram, and stops a banned account from refreshing its token via re-auth.
    await assertInstagramNotBannedOrThrow(userData.id);

    if (isFirstTimeConnection) {
      // First-time link: this IG account must not already be linked elsewhere.
      const existingCustomer = await prisma.customer.findFirst({
        where: { instagram: { instagramUid: userData.id } },
        select: { id: true },
      });
      if (existingCustomer) {
        throw createCustomError(
          2214,
          "This Instagram account is already registered to another Tagly account",
          409
        );
      }
    } else if (customer.instagram!.instagramUid !== userData.id) {
      // Re-authorization: must match the existing link (no account switching).
      throw createCustomError(
        4101,
        "Instagram account does not match current user",
        403
      );
    }

    // 4) Exchange short-lived → long-lived token (encrypted).
    const { encryptedToken, expiresAt } =
      await getAndEncryptIgLongLivedToken(shortLivedToken);

    // 5) Create the IG account (+ nested token) or refresh the existing one.
    let igAccount;
    if (!customer.instagram) {
      // A P2002 on the create (lost race for the same IG uid, which is unique)
      // surfaces as 2214 — the account got taken by someone else first.
      try {
        igAccount = await prisma.customerInstagramAccount.create({
          data: {
            customerId: customer.id,
            instagramUid: userData.id,
            accountType: userData.account_type,
            followerCount: userData.followers_count,
            username: userData.username,
            pfpUrl: userData.profile_picture_url ?? null,
            name: userData.name ?? null,
            instagramToken: {
              create: { accessTokenEnc: encryptedToken, expiresAt },
            },
          },
          select: {
            id: true,
            username: true,
            name: true,
            pfpUrl: true,
            followerCount: true,
            accountType: true,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw createCustomError(
            2214,
            "This Instagram account is already registered to another Tagly account",
            409
          );
        }
        throw e;
      }
    } else {
      igAccount = await prisma.customerInstagramAccount.update({
        where: { id: customer.instagram.id },
        data: {
          accountType: userData.account_type,
          followerCount: userData.followers_count,
          username: userData.username,
          pfpUrl: userData.profile_picture_url ?? null,
          name: userData.name ?? null,
          instagramToken: {
            upsert: {
              create: { accessTokenEnc: encryptedToken, expiresAt },
              update: { accessTokenEnc: encryptedToken, expiresAt },
            },
          },
        },
        select: {
          id: true,
          username: true,
          name: true,
          pfpUrl: true,
          followerCount: true,
          accountType: true,
        },
      });
    }

    // 6) Verify the granted permission (surfaces MISSING_PERMISSION / 4099).
    const { accessToken, instagramUid } =
      await getDecryptedInstagramTokenForCustomer(customerId);
    await checkUserInstagramPermission(accessToken, instagramUid);

    const { id: _id, ...igProfile } = igAccount;

    // Re-auth of an account that already had a snapshot must report
    // `hasSnapshot: true` — the client patches its cached customer with this, so
    // hardcoding false would flash the "rewards calculating" state until the next
    // /me. First-time links resolve to false (no snapshot yet).
    const hasSnapshot = await customerHasSnapshot(customerId);

    // IG account linked/re-authed (token + follower data changed) → invalidate.
    await bumpCustomerRewardEstGen(customerId);

    res.status(200).json({
      instagram: { ...igProfile, hasSnapshot },
    } satisfies ConnectInstagramResponse);
  }
);
