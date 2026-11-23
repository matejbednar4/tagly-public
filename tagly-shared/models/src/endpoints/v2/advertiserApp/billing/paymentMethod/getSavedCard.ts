import { z } from "zod";
import { SavedCardSchema } from "../../../../../dtos/v2/advertiserApp/billing/savedCard";

/**
 * `GET /v2/advertisers/me/billing/payment-method` — the account's saved
 * off-session card (the one card shared by pay-as-you-go and the monthly
 * budget), fetched live from Stripe. Pure read.
 */

// No request body — the advertiser is taken from the JWT.

export const GetSavedCardResponseSchema = z.object({
  /** A saved off-session card is on file. */
  hasCard: z.boolean(),
  /**
   * The card's details (live from Stripe), or null when no card is linked OR
   * the live lookup failed — check `hasCard` to tell the two apart.
   */
  card: SavedCardSchema.nullable(),
});
export type GetSavedCardResponse = z.infer<typeof GetSavedCardResponseSchema>;
