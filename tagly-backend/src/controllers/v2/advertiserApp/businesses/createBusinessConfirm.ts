import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { createBusinessConfirmCore } from "../../../../utils/businesses/write/createBusinessConfirmCore.js";
import type {
  CreateBusinessConfirmBody,
  CreateBusinessConfirmResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/businesses/confirm` — phase 2 of creating a
 * business page. Includes the detail fields (description, links, phone, contact email, opening hours,
 * instagram tag), which are written in the same atomic commit that promotes
 * the pending row — so a created business is complete from its first moment.
 *
 * Thin wire adapter: the whole flow (atomic claim scoped to this advertiser's
 * pending rows, locale re-assert, Link registry, media validate/copy, promote
 * tx, failure cleanup) lives in `createBusinessConfirmCore`, shared with the
 * admin twin (`POST /v2/admin/businesses/confirm`); this controller only
 * shapes the owner-preview response.
 */
export const createBusinessConfirm: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const body = req.validatedBody as CreateBusinessConfirmBody;

    const { localId } = await createBusinessConfirmCore(
      { kind: "advertiser", advertiserId },
      body,
    );

    const created = await prisma.localSubaccount.findUnique({
      where: { id: localId },
      select: {
        uid: true,
        name: true,
        type: { select: { slug: true } },
        banner: {
          select: { uid: true, key: true, aspectRatio: true, type: true },
        },
        address: { select: { city: true } },
      },
    });
    if (!created) throw createCustomError(4604, "Business not found", 404);

    res.status(201).json({
      business: {
        uid: created.uid,
        name: created.name,
        type: { slug: created.type.slug },
        banner: created.banner,
        city: created.address.city,
      },
    } satisfies CreateBusinessConfirmResponse);
  },
);
