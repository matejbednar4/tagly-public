import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { QrStickerIdSchema } from "../../../../core/qrStickers";
import { AdminQrStickerSchema } from "../../../../dtos/v2/adminApp/stickers/adminQrSticker";

/**
 * `PUT /v2/admin/stickers/:id` — assign a printed QR sticker to a business
 * (upsert: first assignment creates the sticker row). A sticker already
 * assigned to a DIFFERENT business is refused (409, code 5310) unless
 * `reassign: true` — reassignment is an explicit admin choice, never an
 * accident. Assigning to the same business is idempotent (updates the note).
 */
export const AdminQrStickerIdParamsSchema = z.object({
  id: QrStickerIdSchema,
});
export type AdminQrStickerIdParams = z.infer<typeof AdminQrStickerIdParamsSchema>;

export const AdminAssignQrStickerBodySchema = z.object({
  businessUid: LocalSubaccountUidSchema,
  note: z.string().trim().max(200).optional(),
  reassign: z.boolean().optional(),
});
export type AdminAssignQrStickerBody = z.infer<
  typeof AdminAssignQrStickerBodySchema
>;

export const AdminAssignQrStickerResponseSchema = z.object({
  message: z.string(),
  sticker: AdminQrStickerSchema,
});
export type AdminAssignQrStickerResponse = z.infer<
  typeof AdminAssignQrStickerResponseSchema
>;
