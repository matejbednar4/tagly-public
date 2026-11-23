import type { RequestHandler } from "express";
import type {
  AdminAssignQrStickerBody,
  AdminAssignQrStickerResponse,
  AdminQrStickerIdParams,
} from "@tagly/models/v2/adminApp";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";

/**
 * v2 admin — `PUT /v2/admin/stickers/:id`. Assign a printed QR sticker to a
 * business (super-admin only). `id` is the OPAQUE printed string, matched
 * exactly as printed (shape-checked by `QrStickerIdSchema`, never normalized).
 *
 * Semantics: a QrSticker row exists iff the sticker currently hangs in a
 * business, and `createdAt` IS the assignment moment — so a (re)assignment is
 * DELETE + CREATE in one transaction, never an in-place move. Re-assigning to
 * the same business just refreshes the row (note + assignedAt).
 *
 * Guards:
 *   - business must exist and not be DELETED (4043) — assigning to a BANNED
 *     business is allowed (admin may prep it), but a deleted page is gone;
 *   - a sticker hanging in a DIFFERENT business is refused (5310, 409) unless
 *     `reassign: true` — moving a sticker is an explicit choice, not a typo.
 */
export const assignQrSticker: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as AdminQrStickerIdParams;
  const { businessUid, note, reassign } =
    req.validatedBody as AdminAssignQrStickerBody;

  const business = await prisma.localSubaccount.findUnique({
    where: { uid: businessUid },
    select: { id: true, status: true },
  });
  if (!business || business.status === "DELETED") {
    throw createCustomError(4043, "Business not found", 404);
  }

  const existing = await prisma.qrSticker.findUnique({
    where: { stickerId: id },
    select: { localId: true, note: true, local: { select: { name: true } } },
  });
  if (existing && existing.localId !== business.id && !reassign) {
    throw createCustomError(
      5310,
      `Sticker ${id} is already assigned to "${existing.local.name}"`,
      409,
    );
  }

  // Delete+create keeps createdAt == assignment moment (see model docblock).
  // A missing note on re-assign keeps the existing one; empty string clears.
  const noteToStore =
    note !== undefined ? note || null : (existing?.note ?? null);
  const sticker = await prisma.$transaction(async (tx) => {
    await tx.qrSticker.deleteMany({ where: { stickerId: id } });
    return tx.qrSticker.create({
      data: { stickerId: id, localId: business.id, note: noteToStore },
      select: { stickerId: true, note: true, createdAt: true },
    });
  });

  res.status(200).json({
    message: "Sticker assigned",
    sticker: {
      stickerId: sticker.stickerId,
      note: sticker.note,
      assignedAt: sticker.createdAt.toISOString(),
    },
  } satisfies AdminAssignQrStickerResponse);
});
