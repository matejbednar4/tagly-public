import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { attachReferrerOrThrow } from "../../../../../utils/referrals/attachReferrerOrThrow.js";
import type { UpdateReferrerCodeBody } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/update/referrer-code` — set who referred this
 * advertiser. **One-time**, and only within 24h of sign-up. Financial-adjacent:
 * it establishes the commission relationship.
 *
 * The guards + the `ReferralEvent` write live in `attachReferrerOrThrow` (the
 * shared write-side chokepoint, also used by the customer twin and the admin
 * fix-it endpoint); this controller only resolves the account. The load → guard
 * → create runs in one transaction so two concurrent sets can't both create a
 * `ReferralEvent`.
 */
export const updateReferrerCode: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { referrerCode } = req.validatedBody as UpdateReferrerCodeBody;

    await prisma.$transaction(async (tx) => {
      const advertiser = await tx.advertiser.findUnique({
        where: { id: advertiserId },
        select: {
          createdAt: true,
          accountReferral: {
            select: { id: true, referredEvent: { select: { id: true } } },
          },
        },
      });
      if (!advertiser) {
        throw createCustomError(1304, "advertiser not found", 404);
      }

      return attachReferrerOrThrow({
        tx,
        accountReferral: advertiser.accountReferral,
        referrerCode,
        signUpWindowFrom: advertiser.createdAt,
      });
    });

    res.status(200).json({ referrerCode });
  },
);
