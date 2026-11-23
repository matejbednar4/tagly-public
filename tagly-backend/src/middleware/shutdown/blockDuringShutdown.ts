import type { RequestHandler } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { ERROR_CODES } from "@tagly/models/shared";
import { envVariables } from "../../environment/envVariables.js";

/**
 * @shutdown — every wind-down block is tagged `@shutdown`; list them all with
 * `grep -rn "@shutdown" tagly-backend/src`.
 *
 * Shutdown gate: rejects the request with 503 + `SERVER.INTERNAL`.
 * **Production only** — on staging/dev it calls `next()`, so the full flows stay
 * usable there.
 *
 * Tagly is winding down (2026-10), so no new money may enter or be earned:
 * mounted on share creation (`POST /v2/customers/shares/create`) and on every
 * non-GET, non-DELETE advertiser billing route (`/v2/advertisers/me/billing`).
 * Everything else stays live on purpose — customer withdrawals (cash-out), the
 * Stripe webhooks (they book the admin refunds), reads, and the billing DELETEs
 * that let a business turn its own top-up / PAYG off.
 *
 * A system code (< 1000) so `callAuthed` always shows its generic alert, even on
 * call sites that pass `handleSpecificErrorManually` (which mute only 1000+).
 * Shipped apps can't show custom copy for an unknown code; the shutdown email +
 * push explain it. `expected`: the gate working as intended, not a bug — muted.
 */
export const blockDuringShutdown: RequestHandler = (_req, _res, next) => {
  if (envVariables.APP_STAGE !== "production") return next();
  next(
    createCustomError(
      ERROR_CODES.SERVER.INTERNAL,
      "Tagly is shutting down. New shares and payments are no longer accepted.",
      { status: 503 /* Service Unavailable */, expected: true },
    ),
  );
};
