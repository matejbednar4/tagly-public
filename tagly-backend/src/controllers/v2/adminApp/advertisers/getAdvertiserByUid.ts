import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateAdvertiser from "../../../../utils/hydrators/admin/adminHydrateAdvertiser.js";
import type { AdminAdvertiserUidParams } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/advertisers/:uid` — one advertiser, hydrated into the full
 * `AdminAdvertiser` DTO (same hydrator the list/search endpoints use).
 * Read-only, SUPER-gated in the router.
 */
export const getAdvertiserByUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminAdvertiserUidParams;

    const row = await prisma.advertiser.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Advertiser not found", 404);

    const advertiser = await adminHydrateAdvertiser({ advertiserId: row.id });

    res.status(200).json({
      message: "Advertiser fetched successfully",
      advertiser,
    });
  },
);
