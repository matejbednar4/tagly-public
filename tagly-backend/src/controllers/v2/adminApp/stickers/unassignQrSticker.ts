import type { RequestHandler } from "express";
import type {
  AdminUnassignQrStickerParams,
  AdminUnassignQrStickerResponse,
} from "@tagly/models/v2/adminApp";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";

/**
 * v2 admin — `DELETE /v2/admin/stickers/:id`. The physical sticker was taken
 * down/retired, so the row is HARD-DELETED (a QrSticker row exists iff the
 * sticker currently hangs in a business). Re-placing the same printed number
 * later is a plain assign. `deleteMany` keeps the miss a clean 404 instead of
 * a Prisma P2025 throw.
 */
export const unassignQrSticker: RequestHandler = asyncHandler(
  async (req, res) => {
    const { id } = req.validatedParams as AdminUnassignQrStickerParams;

    const deleted = await prisma.qrSticker.deleteMany({
      where: { stickerId: id },
    });
    if (deleted.count === 0) {
      throw createCustomError(5311, "Sticker not assigned", 404);
    }

    res.status(200).json({
      message: "Sticker unassigned",
    } satisfies AdminUnassignQrStickerResponse);
  },
);
