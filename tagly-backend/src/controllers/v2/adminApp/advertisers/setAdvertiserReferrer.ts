import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { attachReferrerOrThrow } from "../../../../utils/referrals/attachReferrerOrThrow.js";
import type {
  AdminAdvertiserUidParams,
  AdminSetAdvertiserReferrerBody,
  AdminSetAdvertiserReferrerResponse,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/advertisers/:uid/referrer` — record who referred an
 * advertiser, after the fact. Covers the sales-assisted gap the in-app endpoint
 * can't: an influencer brings a business, sales onboards it, and nobody tells
 * the business to enter the code — so the referral that should exist never does.
 *
 * Shares `attachReferrerOrThrow` with the two in-app endpoints, so the guards
 * and the error ladder are identical, with two differences it passes in:
 * **no sign-up window** (the whole point is that the window is long gone), and
 * the acting admin + optional reason are stamped on the `ReferralEvent` as the
 * audit trail — the only way to tell an admin-linked referral from a
 * self-entered one afterwards. It stays **set-only**: an advertiser that
 * already has a referrer 409s, so an established commission relationship can
 * never be redirected from here.
 *
 * Financial-adjacent: the `ReferralEvent` is what later drives referral payouts.
 * It is **not** retroactive — already-settled shares keep the payouts they had;
 * from here on the referrer earns their cut. The event's `createdAt` is now, so
 * the ~6-month full-strength boost window starts today rather than at sign-up.
 */
export const setAdvertiserReferrer: RequestHandler = asyncHandler(
  async (req, res) => {
    const adminId = req.user.id;
    const { uid: advertiserUid } =
      req.validatedParams as AdminAdvertiserUidParams;
    const { referrerCode, reason } =
      req.validatedBody as AdminSetAdvertiserReferrerBody;

    const attached = await prisma.$transaction(async (tx) => {
      const advertiser = await tx.advertiser.findUnique({
        where: { uid: advertiserUid },
        select: {
          uid: true,
          accountReferral: {
            select: { id: true, referredEvent: { select: { id: true } } },
          },
        },
      });
      if (!advertiser) {
        throw createCustomError(4043, "Advertiser not found", 404);
      }

      const result = await attachReferrerOrThrow({
        tx,
        accountReferral: advertiser.accountReferral,
        referrerCode,
        setByAdminId: adminId,
        adminReason: reason?.trim() ? reason.trim() : null,
      });

      return { advertiserUid: advertiser.uid, ...result };
    });

    res.status(201).json({
      message: "Referrer set successfully",
      advertiserUid: attached.advertiserUid,
      referrerCode: attached.referrerCode,
      referrerUid: attached.referrerUid,
      referrerType: attached.referrerType,
      at: attached.createdAt.toISOString(),
    } satisfies AdminSetAdvertiserReferrerResponse);
  },
);
