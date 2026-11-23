import { z } from "zod";

/**
 * `DELETE /v2/customers/me/instagram` — disconnect the logged-in customer's
 * Instagram so they can connect a different account ("I linked the wrong one").
 *
 * This is a HARD delete of the `CustomerInstagramAccount` row — the cascade is
 * the snapshot-safety mechanism: it removes the token, audience snapshots (+
 * their children) and snapshot queues, so a later connect of a *different* IG
 * can never inherit the old account's audience data. Any in-flight (PROCESSING)
 * shares are voided (→ UNPAYABLE) and their budget released first; PAID shares
 * are untouched and keep their `igPostId` (which blocks re-earning on the same
 * post after a reconnect).
 *
 * Idempotent: no linked account → 200 no-op. The client clears its cached
 * `customer.instagram` itself, so the response is just a message.
 */
export const DisconnectInstagramResponseSchema = z.object({
  message: z.string(),
});
export type DisconnectInstagramResponse = z.infer<
  typeof DisconnectInstagramResponseSchema
>;
