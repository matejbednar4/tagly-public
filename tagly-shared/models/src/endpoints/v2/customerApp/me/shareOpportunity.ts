import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";
import { InstagramStorySchema } from "../../../../core/instagram";

/**
 * `GET /v2/customers/me/share-opportunity` — the app-open share nudge.
 *
 * On app open/resume the client sends its current location; the server decides,
 * fully server-side, whether the customer is standing inside a Tagly business
 * they can share right now — and, if one of their **live Instagram stories**
 * already tags that business (Rekognition OCR), promotes the nudge to a one-tap
 * "does this story promote this business?" confirmation.
 *
 * Two scenarios are implemented; a "you posted new content, want to monetize
 * it?" scenario is intentionally NOT one of them (there is no in-prompt
 * business picker to attach loose content to).
 *
 * Scenarios (discriminated on `scenario`):
 *   - `"none"`                → nothing to nudge.
 *   - `"inBusiness"`          → exactly one shareable business is within
 *                               `NEARBY_DISTANCE_METERS`; prompt "share it?".
 *   - `"inBusinessWithStory"` → same, and exactly one live story's text matches
 *                               that business; prompt "does this story promote
 *                               this business?" with the matched story pre-filled.
 */

/** Query (GET) — device location is required (both scenarios are location-gated). */
export const GetShareOpportunityQuerySchema = z.object({
  currentLat: z.coerce.number().gte(-90).lte(90),
  currentLon: z.coerce.number().gte(-180).lte(180),});
export type GetShareOpportunityQuery = z.infer<
  typeof GetShareOpportunityQuerySchema
>;

/** Response — a discriminated union on `scenario`. */
export const GetShareOpportunityResponseSchema = z.discriminatedUnion(
  "scenario",
  [
    z.object({ scenario: z.literal("none") }),
    z.object({
      scenario: z.literal("inBusiness"),
      /** The single shareable business the customer is standing inside. */
      business: BusinessPublicPreviewSchema,
    }),
    z.object({
      scenario: z.literal("inBusinessWithStory"),
      /** The single shareable business the customer is standing inside. */
      business: BusinessPublicPreviewSchema,
      /** The live story whose text Rekognition matched to that business. */
      story: InstagramStorySchema,
    }),
  ]
);
export type GetShareOpportunityResponse = z.infer<
  typeof GetShareOpportunityResponseSchema
>;
