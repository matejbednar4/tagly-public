import type { RequestHandler } from "express";
import type {
  AdminBusinessUidParams,
  AdminGetBusinessQrStickersResponse,
} from "@tagly/models/v2/adminApp";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";

/**
 * v2 admin — `GET /v2/admin/businesses/:uid/stickers`. All QR stickers
 * currently hanging in a business, newest assignment first (`createdAt` is
 * the assignment moment — reassignment recreates the row). The data behind
 * the "QR stickers" section of the admin business detail screen.
 */
export const getBusinessQrStickers: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;

    const business = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!business) {
      throw createCustomError(4043, "Business not found", 404);
    }

    const stickers = await prisma.qrSticker.findMany({
      where: { localId: business.id },
      orderBy: { createdAt: "desc" },
      select: { stickerId: true, note: true, createdAt: true },
    });

    res.status(200).json({
      message: "Stickers fetched",
      stickers: stickers.map((s) => ({
        stickerId: s.stickerId,
        note: s.note,
        assignedAt: s.createdAt.toISOString(),
      })),
    } satisfies AdminGetBusinessQrStickersResponse);
  },
);
