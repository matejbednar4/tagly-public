import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { businessOwnerVisibleWhere } from "../../../../utils/businesses/businessAccessibility.js";
import hydrateBusinessOwnerDetails from "../../../../utils/hydrators/businesses/hydrateBusinessOwnerDetails.js";
import type { GetBusinessByUidParams } from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/businesses/:uid` — one of the advertiser's own
 * business pages in full (the owner-facing detail screen).
 *
 * Ownership is the query filter (IDOR-safe: `{ uid, advertiserId }`), so an
 * advertiser can only read their own page. Hydrates the full
 * `BusinessOwnerDetails`.
 *
 * Every request returns a fresh body — deliberately no ETag/304 layer (see the
 * customer twin: timestamp-probe ETags must mirror every hydrator input and
 * silently rot when a derived field is added). Client-side staleness is
 * bounded by the detail hook's `staleTime`.
 */
export const getBusinessByUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as GetBusinessByUidParams;
    const advertiserId = req.user.id;

    const lite = await prisma.localSubaccount.findFirst({
      where: { uid, advertiserId, ...businessOwnerVisibleWhere },
      select: { id: true },
    });
    if (!lite) throw createCustomError(4604, "Business not found", 404);

    const business = await hydrateBusinessOwnerDetails({ businessId: lite.id });
    if (!business) throw createCustomError(4604, "Business not found", 404);

    res.status(200).json({ business });
  },
);
