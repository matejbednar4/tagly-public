import { envVariables } from "../../../environment/envVariables.js";
import { getPostHog } from "../../clients/posthog.js";

/**
 * The single product-analytics sink for backend-emitted events — the analytics
 * twin of `reportError` (which owns errors). Use it for low-volume product
 * events only the server can see truthfully (e.g. the notifications worker's
 * `promo_notification_sent`, which pairs with the clients' `push_opened` to
 * give per-step open rates). Same PostHog project as the client apps, kept
 * apart by the `app: "backend"` property (mirroring `reportError`); `service`
 * is the sub-stream (worker name / "api").
 *
 * `distinctId` must be a stable pseudonymous entity key — the account uid
 * (via `resolveRecipientAnalyticsId`), or `TARGET:id` for pending accounts
 * only — never PII and never a bare DB primary key of a real account.
 * `$process_person_profile: false` keeps the events person-less, matching the
 * clients' anonymous ("identified_only") posture.
 *
 * Fail-open and fire-and-forget: a tracking failure must never affect the
 * caller. The vendor is named only in `clients/posthog.ts`.
 */
export function captureServerEvent(args: {
  event: string;
  /** Stable pseudonymous entity key (uid, or TARGET:id for pendings); never PII. */
  distinctId: string;
  /** Sub-stream within `app: "backend"` — the worker name or "api". */
  service: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
}): void {
  try {
    getPostHog().capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: {
        app: "backend",
        app_env: envVariables.APP_STAGE,
        service: args.service,
        $process_person_profile: false,
        ...args.properties,
      },
    });
  } catch {
    // never let tracking throw into the caller
  }
}
