import type { RequestHandler } from "express";
import type { AgreeWithPrivacyPolicyResponse } from "@tagly/models/v2/crossApp";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { getEntityFromUid } from "../../../utils/core/uids/getEntityFromUid.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import prisma from "../../../prisma/prisma.js";

/**
 * `POST /v2/cross/privacy-policy/agree` — twin of `agreeWithTos` for the Privacy
 * Policy. Stamps `agreedToPrivacyPolicyAt = now`, which clears the
 * `shouldAgreeWithLatestPrivacyPolicy` gate on `GET /me`. Fires from the blocking
 * app-open Privacy modal.
 */
export const agreeWithPrivacyPolicy: RequestHandler = asyncHandler(
  async (req, res) => {
    const { id, uid } = req.user;
    const entity = getEntityFromUid(uid);

    if (entity !== "ADVERTISER" && entity !== "CUSTOMER") {
      throw createCustomError(
        4785,
        "Only advertisers and customers can agree with the Privacy Policy.",
        401,
      );
    }

    if (entity === "ADVERTISER") {
      await prisma.advertiser.update({
        where: { id },
        data: { agreedToPrivacyPolicyAt: new Date() },
      });
    } else {
      await prisma.customer.update({
        where: { id },
        data: { agreedToPrivacyPolicyAt: new Date() },
      });
    }

    res.status(200).json({
      agreedWithLatestPrivacyPolicy: true,
    } satisfies AgreeWithPrivacyPolicyResponse);
  },
);
