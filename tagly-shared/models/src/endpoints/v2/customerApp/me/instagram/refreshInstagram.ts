import { z } from "zod";
import { CustomerInstagramAccountSchema } from "../../../../../dtos/v2/customerApp/me/customerInstagram";

/**
 * `POST /v2/customers/me/instagram/refresh` — the cold-start IG probe (called
 * for IG-linked users). Makes a live Graph call to verify the connection +
 * permission, refreshes the cached profile, and opportunistically queues an
 * audience snapshot when the latest one is stale/missing.
 *
 * The HTTP error codes ARE the connection-state signal the client maps:
 *   - 403 / 4099           → MISSING_PERMISSION (token valid, missing scope)
 *   - 400 / 5007 · 5008    → DISCONNECTED (revoked / no token)
 *   - 400 / 5009 · 502 / 5110 → EXPIRED_TOKEN (lapsed, refresh failed)
 * A 200 means CONNECTED.
 */
export const RefreshInstagramResponseSchema = z.object({
  instagram: CustomerInstagramAccountSchema,
  /** True if this call enqueued a fresh audience snapshot job. */
  snapshotQueued: z.boolean(),
  /** True if the account already had at least one audience snapshot. */
  alreadyHadSnapshot: z.boolean(),
});
export type RefreshInstagramResponse = z.infer<
  typeof RefreshInstagramResponseSchema
>;
