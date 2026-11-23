import { z } from "zod";
import { CustomerInstagramAccountSchema } from "../../../../../dtos/v2/customerApp/me/customerInstagram";

/**
 * `POST /v2/customers/me/instagram/connect` — link or re-authorize the logged-in
 * customer's Instagram. Handles two scenarios off the same `code`:
 *   - **First-time link** (the customer onboarded without Instagram): connects a
 *     new IG account, rejecting one already tied to another Tagly account.
 *   - **Re-authorization** (recover a DISCONNECTED / EXPIRED_TOKEN / token, or
 *     grant the insights permission): refreshes the stored token + profile,
 *     requiring the same IG account (no silent account switching).
 *
 * The error codes double as the resulting connection-state signal the client
 * maps — notably `403 / 4099` → MISSING_PERMISSION when the insights scope wasn't
 * granted. A 200 means CONNECTED, and returns the refreshed profile.
 */
export const ConnectInstagramBodySchema = z.object({
  /** The OAuth authorization code from the IG re-auth flow. */
  code: z.string().min(1),
});
export type ConnectInstagramBody = z.infer<typeof ConnectInstagramBodySchema>;

export const ConnectInstagramResponseSchema = z.object({
  instagram: CustomerInstagramAccountSchema,
});
export type ConnectInstagramResponse = z.infer<
  typeof ConnectInstagramResponseSchema
>;
