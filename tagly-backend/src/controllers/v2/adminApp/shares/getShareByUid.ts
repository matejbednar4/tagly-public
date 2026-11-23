import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";
import type { AdminShareUidParams } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/shares/:uid` — one share, hydrated into the full `AdminShare`
 * DTO (same batch hydrator the list/search endpoints use, called with a single
 * id). Read-only, SUPER-gated in the router.
 */
export const getShareByUid: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = req.validatedParams as AdminShareUidParams;

  const row = await prisma.share.findUnique({
    where: { uid },
    select: { id: true },
  });
  if (!row) throw createCustomError(4043, "Share not found", 404);

  const [share] = await adminHydrateShare({ shareIds: [row.id] });
  if (!share) throw createCustomError(4043, "Share not found", 404);

  res.status(200).json({
    message: "Share fetched successfully",
    share,
  });
});
