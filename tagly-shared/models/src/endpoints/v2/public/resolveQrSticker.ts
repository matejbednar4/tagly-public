import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../core/uids";
import { QrStickerIdSchema } from "../../../core/qrStickers";

/**
 * v2 `GET /v2/public/stickers/:id` — resolve a printed QR sticker number to
 * the business it is placed in. Unauthenticated: the join page calls this to
 * personalize the landing hero ("Earn at Café XYZ") when a sticker QR is
 * scanned (`https://join.tagly.cz/?utm_source=table-sticker&id=000123`).
 *
 * `id` is the OPAQUE string printed on the physical sticker, matched exactly
 * as printed (`QrStickerIdSchema` shape-checks, never normalizes).
 * Unknown or unassigned stickers 404 so the page falls back to generic copy.
 *
 * `referralCode` is the owning ADVERTISER's active referral code (businesses
 * don't have codes of their own) — the join page threads it into the store
 * handoff so a sticker-acquired customer is referred by the business owner.
 * Null for platform-subsidized/unowned businesses or an inactive code. An
 * explicit `?code=` in the scanned URL always wins over this ambient code.
 */
export const ResolveQrStickerParamsSchema = z.object({
  id: QrStickerIdSchema,
});
export type ResolveQrStickerParams = z.infer<typeof ResolveQrStickerParamsSchema>;

export const ResolveQrStickerResponseSchema = z.object({
  message: z.string(),
  business: z.object({
    uid: LocalSubaccountUidSchema,
    name: z.string(),
    referralCode: z.string().nullable(),
  }),
});
export type ResolveQrStickerResponse = z.infer<
  typeof ResolveQrStickerResponseSchema
>;
