import { z } from "zod";

/**
 * GET /v2/admin/notifications/sender-domains — the sending identities a blast
 * can use, read LIVE from Resend (verified domains only) so the list never
 * drifts from what can actually send. `defaultFromEmail` is the standard
 * marketing sender used when no override is picked; each domain option sends
 * as `notifications@<domain>`.
 *
 * ⚠️ Resend verification is not the whole story: a domain must ALSO be
 * registered for Apple private relay (Sign in with Apple for Email
 * Communication) or `@privaterelay.appleid.com` recipients silently bounce —
 * invisible to Resend. All currently verified domains are registered.
 */
export const AdminGetBlastSenderDomainsResponseSchema = z.object({
  message: z.string(),
  defaultFromEmail: z.string(),
  /** Resend-verified domains usable as `senderDomain` overrides. */
  domains: z.array(
    z.object({
      domain: z.string(),
      /** The exact From address a blast with this override sends as. */
      fromEmail: z.string(),
    }),
  ),
});
export type AdminGetBlastSenderDomainsResponse = z.infer<
  typeof AdminGetBlastSenderDomainsResponseSchema
>;
