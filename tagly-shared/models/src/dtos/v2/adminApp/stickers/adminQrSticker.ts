import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { QrStickerIdSchema } from "../../../../core/qrStickers";

/**
 * A printed physical QR sticker as the admin app sees it. `stickerId` is the
 * OPAQUE id printed on the sticker, matched exactly as printed ("000001"
 * today, possibly random strings in future batches — see core/qrStickers).
 * A row exists iff the sticker currently hangs in a business (unassigning
 * hard-deletes; reassigning recreates, so `assignedAt` is the current
 * assignment moment). Admin-only DTO — no back-compat obligations.
 */
export const AdminQrStickerSchema = z.object({
  stickerId: QrStickerIdSchema,
  note: z.string().nullable(),
  assignedAt: ISODateSchema,
});
export type AdminQrSticker = z.infer<typeof AdminQrStickerSchema>;
export type AdminQrStickerInput = z.input<typeof AdminQrStickerSchema>;
