import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type { AdminBusinessUidParams } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/businesses/:uid` — one business (local subaccount), hydrated
 * into the full `AdminBusiness` DTO (same batch hydrator the list/search
 * endpoints use, called with a single id). Read-only, SUPER-gated in the router.
 */
export const getBusinessByUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;

    const row = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Business not found", 404);

    const [business] = await adminHydrateLocal({ localIds: [row.id] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    res.status(200).json({
      message: "Business fetched successfully",
      business,
    });
  },
);
