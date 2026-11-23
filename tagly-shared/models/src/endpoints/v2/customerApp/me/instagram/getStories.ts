import { z } from "zod";
import { InstagramStorySchema } from "../../../../../core/instagram";

/**
 * `GET /v2/customers/me/instagram/stories` — the logged-in customer's live
 * Instagram stories, the only media type v2 shares support. No request body
 * (the JWT identifies the customer); already-shared stories are filtered server
 * side. Stories are inherently 9:16, so the wire carries no dimensions.
 */
export const GetIgStoriesResponseSchema = z.object({
  message: z.string(),
  stories: z.array(InstagramStorySchema),
});
export type GetIgStoriesResponse = z.infer<typeof GetIgStoriesResponseSchema>;
