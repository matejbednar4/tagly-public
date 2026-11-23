import { z } from "zod";

/**
 * v2 — `GET /v2/admin/balance/stripe`. Live platform Stripe balance broken
 * down into assigned/unassigned buckets (the aggregation lives in the permanent
 * util `retrieveAvailableStripeBalance`). Fetched on demand — this hits the
 * Stripe API, so it is not part of the cached statistics aggregate.
 */
export const AdminGetStripeBalanceResponseSchema = z.object({
  message: z.string(),
  /** Full USD balance on the Tagly Stripe platform account. */
  stripeBalanceCents: z.number(),
  /** Sum of all advertiser available + locked credit balances. */
  assignedToAdvertisersCents: z.number(),
  /** Sum of all customer available + locked reward balances. */
  assignedToCustomersCents: z.number(),
  /** Locked between subsidized share creation and share payment. */
  lockedForSubsidizedSharesCents: z.number(),
  /** Total minus all assigned and locked funds — free for subsidies/promos. */
  unassignedCents: z.number(),
});
export type AdminGetStripeBalanceResponse = z.infer<
  typeof AdminGetStripeBalanceResponseSchema
>;
