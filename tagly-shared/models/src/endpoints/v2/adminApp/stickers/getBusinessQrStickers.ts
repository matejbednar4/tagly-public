import { z } from "zod";
import { AdminQrStickerSchema } from "../../../../dtos/v2/adminApp/stickers/adminQrSticker";

/**
 * `GET /v2/admin/businesses/:uid/stickers` — all QR stickers assigned to a
 * business, newest assignment first. Params reuse
 * `AdminBusinessUidParamsSchema` (registered at the route). Businesses hold
 * many stickers (sometimes dozens), so this renders as a chip list on the
 * admin business detail screen.
 */
export const AdminGetBusinessQrStickersResponseSchema = z.object({
  message: z.string(),
  stickers: z.array(AdminQrStickerSchema),
});
export type AdminGetBusinessQrStickersResponse = z.infer<
  typeof AdminGetBusinessQrStickersResponseSchema
>;
