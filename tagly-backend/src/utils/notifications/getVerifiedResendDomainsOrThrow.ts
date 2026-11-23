import { CONTACT } from "../../constants/platform/CONTACT.js";
import { envVariables } from "../../environment/envVariables.js";
import { resendClient } from "../clients/resend.js";
import { createCustomError } from "../core/errors/createCustomError.js";

/**
 * The domain names an admin blast may send from. Used by the admin blast
 * surface: the sender-domains endpoint lists them for the compose UI, and
 * `adminSendBlast` re-verifies a chosen `senderDomain` against them before
 * enqueueing anything (only a verified domain may ever be a From identity — an
 * unverified one would have every send rejected by Resend).
 *
 * PRODUCTION reads the list live via `resend.domains.list()` — the account's
 * verified set (incl. legacy domains) is the truth, and the production
 * RESEND_API_KEY is full-access so the call works. Throws 5783 when Resend
 * can't be reached — the callers are interactive admin actions, so failing
 * loudly beats guessing.
 *
 * NON-PROD short-circuits to the sender domains derived from `CONTACT` (both
 * resolve to `mail.tagly.dev`): the staging/dev RESEND_API_KEY is deliberately
 * send-only + domain-restricted to that one domain, so `domains.list()` is a
 * guaranteed 401 AND no other domain could be sent from anyway. The static
 * list skips Resend's verified check, which is fine in non-prod — if the
 * domain were somehow unverified, the worker's sends fail visibly at send
 * time.
 */
export async function getVerifiedResendDomainsOrThrow(): Promise<string[]> {
  if (envVariables.APP_STAGE !== "production") {
    return [
      ...new Set(
        [CONTACT.NOTIFICATIONS_FROM_EMAIL, CONTACT.MARKETING_FROM_EMAIL].map(
          (address) => address.split("@")[1],
        ),
      ),
    ];
  }

  const res = await resendClient.domains.list();
  if (res.error || !res.data) {
    throw createCustomError(5783, "Could not list sender domains", {
      status: 502,
      cause: res.error ? new Error(res.error.message) : undefined,
    });
  }
  return res.data.data
    .filter((d) => d.status === "verified")
    .map((d) => d.name);
}
