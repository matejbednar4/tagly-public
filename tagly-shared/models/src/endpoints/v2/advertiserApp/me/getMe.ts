import { z } from "zod";
import { AdvertiserMeSchema } from "../../../../dtos/v2/advertiserApp/me/advertiserMe";

/**
 * `GET /v2/advertisers/me` — fetch the logged-in advertiser's lean core
 * profile. Authed (JWT); takes no body/query/params. The (app) shell fetches it
 * on sign-in to drive the setup gate (the derived `funded` / `hasBusinessPage`
 * facts) and locale-dependent UX (PAYG consent checkbox).
 */
export const GetMeResponseSchema = z.object({
  advertiser: AdvertiserMeSchema,
});
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;
