import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { Prisma } from "../../../../../generated/prisma/client.js";
import type { UpdateReferralCodeBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/referral-code` — change the customer's own
 * referral code. **One-time only**: the code can be changed exactly once (from the
 * auto-generated default), after which `codeUpdatedAt` is set and it's locked
 * forever. Also globally unique. Not financial — the code is a vanity slug and
 * this doesn't touch any referral *relationship* or payout.
 *
 * Flow: reject a code taken by another account (pre-check + P2002 backstop for the
 * check→write race), then atomically set it only while `codeUpdatedAt` is still
 * null (never changed). A code taken → 1220; an already-used one-time change → 1219.
 */
export const updateReferralCode: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { referralCode } = req.validatedBody as UpdateReferralCodeBody;

    const taken = await prisma.accountReferral.findFirst({
      where: { code: referralCode, NOT: { customer: { id: customerId } } },
      select: { id: true },
    });
    if (taken) {
      throw createCustomError(1220, "referral code is already taken", 409);
    }

    const now = new Date();

    // Atomic one-time gate: only set the code while it has never been changed
    // (`codeUpdatedAt` null). The first change stamps `codeUpdatedAt` and locks it.
    let result;
    try {
      result = await prisma.accountReferral.updateMany({
        where: { customer: { id: customerId }, codeUpdatedAt: null },
        data: { code: referralCode, codeUpdatedAt: now },
      });
    } catch (e) {
      // Another account claimed the code between the pre-check and the write.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw createCustomError(1220, "referral code is already taken", 409);
      }
      throw e;
    }

    if (result.count === 0) {
      const current = await prisma.accountReferral.findFirst({
        where: { customer: { id: customerId } },
        select: { codeUpdatedAt: true },
      });
      if (!current) {
        throw createCustomError(1218, "customer referral not found", 404);
      }
      // `codeUpdatedAt` is already set → the one-time change was used.
      throw createCustomError(
        1219,
        "referral code can only be changed once",
        403,
      );
    }

    res.status(200).json({ referralCode, referralCodeUpdatedAt: now });
  },
);
