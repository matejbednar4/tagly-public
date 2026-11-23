import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import { exchangeIGCodeForToken } from "../../../../../utils/instagram/tokens/exchangeIGCodeForToken.js";
import { getUserDataFromIG } from "../../../../../utils/instagram/accountInsights/getUserDataFromIg.js";
import { getAndEncryptIgLongLivedToken } from "../../../../../utils/instagram/tokens/getAndEncryptIgLLT.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import type {
  InstagramLoginBody,
  InstagramLoginResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/instagram-login` — log in via Instagram for
 * users who linked it but forgot their email. Exchanges the IG OAuth `code`,
 * finds the Customer by their linked IG identity, then issues a session JWT.
 *
 * Since the user just re-authorized, we opportunistically refresh the stored IG
 * snapshot (username/followers/pfp/…) and the long-lived token — the latter
 * heals a token that expired while they were away, so the insights/snapshot
 * workers can resume. This refresh is **best-effort**: a transient IG/DB hiccup
 * must not block the login.
 *
 * Only matches Customers with a linked IG account; someone who finished
 * onboarding without Instagram has nothing to match on here and recovers via
 * email instead.
 */
export const instagramLogin: RequestHandler = asyncHandler(async (req, res) => {
  const { code } = req.validatedBody as InstagramLoginBody;

  const shortLivedToken = await exchangeIGCodeForToken(code);
  const userData = await getUserDataFromIG(shortLivedToken);

  const customer = await prisma.customer.findFirst({
    where: { instagram: { instagramUid: userData.id } },
    select: {
      id: true,
      uid: true,
      jwtVersion: true,
      instagram: { select: { id: true } },
    },
  });
  if (!customer || !customer.instagram) {
    throw createCustomError(
      2215,
      "No Tagly account found for this Instagram account",
      404,
    );
  }

  // Opportunistic refresh of the IG snapshot + long-lived token (the user just
  // re-authorized). Best-effort — never block the login on it; the workers will
  // refresh later if this fails.
  try {
    const { encryptedToken, expiresAt } =
      await getAndEncryptIgLongLivedToken(shortLivedToken);
    await prisma.customerInstagramAccount.update({
      where: { id: customer.instagram.id },
      data: {
        username: userData.username,
        followerCount: userData.followers_count,
        accountType: userData.account_type,
        pfpUrl: userData.profile_picture_url ?? null,
        name: userData.name ?? null,
        instagramToken: {
          upsert: {
            create: { accessTokenEnc: encryptedToken, expiresAt },
            update: { accessTokenEnc: encryptedToken, expiresAt },
          },
        },
      },
    });
    // Follower data refreshed on re-auth → invalidate the estimate cache.
    await bumpCustomerRewardEstGen(customer.id);
  } catch {
    // Login still succeeds with the existing stored data/token.
  }

  res.status(200).json({
    jwt: issueSessionJwt(customer),
  } satisfies InstagramLoginResponse);
});
