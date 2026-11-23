import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { AdvertiserShareDetailsSchema } from "../../../../dtos/v2/advertiserApp/shares/advertiserShareDetails";

/**
 * Path params for the single-share advertiser routes (`GET /:uid`,
 * `POST /:uid/assessment`). Shared so the share UID is validated identically.
 */
export const ShareUidParamsSchema = z.object({ uid: ShareUidSchema });
export type ShareUidParams = z.infer<typeof ShareUidParamsSchema>;

/**
 * `GET /v2/advertisers/shares/:uid` — one of the advertiser's shares by UID
 * (deep-linkable detail screen). Authed; pure read. Returns the richer
 * `AdvertiserShareDetails` — the preview plus the story's Instagram `insights`
 * and `paidAt`. Insights are surfaced ONLY here (not on previews / the rate
 * sheet) and are safe because the screen is rating-gated: they can't be seen
 * until the share is assessed, so they can't bias the rating.
 */
export const GetAdvertiserShareResponseSchema = z.object({
  share: AdvertiserShareDetailsSchema,
});
export type GetAdvertiserShareResponse = z.infer<
  typeof GetAdvertiserShareResponseSchema
>;
