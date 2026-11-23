import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { attachReferrerOrThrow } from "../../../../../utils/referrals/attachReferrerOrThrow.js";
import type { UpdateReferrerCodeBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/referrer-code` — set who referred this
 * customer. **One-time**, and only within 24h of sign-up. Financial-adjacent:
 * it establishes the commission relationship.
 *
 * The guards + the `ReferralEvent` write live in `attachReferrerOrThrow` (the
 * shared write-side chokepoint, also used by the advertiser twin and the admin
 * fix-it endpoint); this controller only resolves the account. The load → guard
 * → create runs in one transaction so two concurrent sets can't both create a
 * `ReferralEvent`.
 */
export const updateReferrerCode: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { referrerCode } = req.validatedBody as UpdateReferrerCodeBody;

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          createdAt: true,
          accountReferral: {
            select: { id: true, referredEvent: { select: { id: true } } },
          },
        },
      });
      if (!customer) {
        throw createCustomError(1002, "customer not found", 404);
      }

      return attachReferrerOrThrow({
        tx,
        accountReferral: customer.accountReferral,
        referrerCode,
        signUpWindowFrom: customer.createdAt,
      });
    });

    res.status(200).json({ referrerCode });
  },
);
