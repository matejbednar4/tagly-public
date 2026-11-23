import type { RequestHandler } from "express";
import type { AgreeWithTosResponse } from "@tagly/models/v2/crossApp";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { getEntityFromUid } from "../../../utils/core/uids/getEntityFromUid.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import prisma from "../../../prisma/prisma.js";

/**
 * `POST /v2/cross/terms-of-service/agree` — record the authed user's agreement
 * to the latest Terms of Service by stamping `agreedToTermsOfServiceAt = now`.
 *
 * Cross-app (either app's JWT): both customers and advertisers re-accept when a
 * new ToS version ships. The re-acceptance gate itself
 * (`shouldAgreeWithLatestTos` on `GET /me`) is derived by comparing this
 * timestamp against `LATEST_TERMS_OF_SERVICE_RELEASE_DATE`, so stamping `now`
 * clears it. Fires from the blocking app-open ToS modal. Twin of
 * `agreeWithPrivacyPolicy`.
 */
export const agreeWithTos: RequestHandler = asyncHandler(async (req, res) => {
  const { id, uid } = req.user;
  const entity = getEntityFromUid(uid);

  if (entity !== "ADVERTISER" && entity !== "CUSTOMER") {
    throw createCustomError(
      4785,
      "Only advertisers and customers can agree with the Terms of Service.",
      401,
    );
  }

  if (entity === "ADVERTISER") {
    await prisma.advertiser.update({
      where: { id },
      data: { agreedToTermsOfServiceAt: new Date() },
    });
  } else {
    await prisma.customer.update({
      where: { id },
      data: { agreedToTermsOfServiceAt: new Date() },
    });
  }

  res
    .status(200)
    .json({ agreedWithLatestTos: true } satisfies AgreeWithTosResponse);
});
