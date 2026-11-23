import { z } from "zod";
import { AdminQrStickerIdParamsSchema } from "./assignQrSticker";

/**
 * `DELETE /v2/admin/stickers/:id` — the sticker was physically removed from
 * the business, so the row is HARD-DELETED (a QrSticker row exists iff the
 * sticker currently hangs in a business — see the Prisma model). Re-placing
 * the same printed number later is a plain assign. 404 if not assigned.
 */
export const AdminUnassignQrStickerParamsSchema = AdminQrStickerIdParamsSchema;
export type AdminUnassignQrStickerParams = z.infer<
  typeof AdminUnassignQrStickerParamsSchema
>;

export const AdminUnassignQrStickerResponseSchema = z.object({
  message: z.string(),
});
export type AdminUnassignQrStickerResponse = z.infer<
  typeof AdminUnassignQrStickerResponseSchema
>;
