import { z } from "zod";

// One-time login link to the customer's Stripe Express Dashboard (payout history,
// bank details). Short-lived; the client opens it immediately.
export const CreateExpressDashboardLinkResponseSchema = z.object({
  url: z.url(),
});
export type CreateExpressDashboardLinkResponse = z.infer<
  typeof CreateExpressDashboardLinkResponseSchema
>;
