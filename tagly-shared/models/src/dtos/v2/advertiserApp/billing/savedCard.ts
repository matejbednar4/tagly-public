import { z } from "zod";

/**
 * The advertiser's saved off-session card — the ONE card shared by
 * pay-as-you-go and the monthly budget — as shown in the app. Fetched live
 * from Stripe on every read; the backend never stores card details.
 */
export const SavedCardSchema = z.object({
  /** Stripe brand slug, e.g. "visa", "mastercard". */
  brand: z.string(),
  last4: z.string(),
  expMonth: z.number().int(),
  expYear: z.number().int(),
});
export type SavedCard = z.infer<typeof SavedCardSchema>;
