import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { businessOwnerVisibleWhere } from "../../../../utils/businesses/businessAccessibility.js";
import type { GetBusinessesResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/businesses` — the advertiser's own business pages
 * (non-deleted local subaccounts), newest first, shaped as
 * `BusinessOwnerPreview` cards (same projection the create-confirm response
 * uses). Pure read; ownership is the query filter itself.
 */
export const getBusinesses: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;

  const locals = await prisma.localSubaccount.findMany({
    where: { advertiserId, ...businessOwnerVisibleWhere },
    orderBy: { createdAt: "desc" },
    select: {
      uid: true,
      name: true,
      type: { select: { slug: true } },
      banner: { select: { uid: true, key: true, aspectRatio: true, type: true } },
      address: { select: { city: true } },
    },
  });

  res.status(200).json({
    businesses: locals.map((l) => ({
      uid: l.uid,
      name: l.name,
      type: { slug: l.type.slug },
      banner: l.banner,
      city: l.address.city,
    })),
  } satisfies GetBusinessesResponse);
});
