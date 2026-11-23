import Stripe from "stripe";

/**
 * Split Stripe SDK errors into DEFINITIVE rejections vs AMBIGUOUS failures — the
 * W-16/W-17 money-safety classification (withdrawals.md), shared by the
 * withdrawal orchestrator's transfer catch and the reconciliation worker's
 * missing-transfer pass so the two sites can never drift.
 *
 * **Definitive** — Stripe received, understood, and REFUSED the request; the
 * object was certainly not created, so releasing locked funds is safe:
 * InvalidRequest / Card / Permission / Authentication errors.
 *
 * **Ambiguous** — the request may have been processed with only the response
 * lost (connection drop, timeout, Stripe 5xx, rate limit, anything unknown); the
 * only safe reaction is to keep state and reconcile against Stripe later —
 * never release locked funds on an ambiguous error.
 */
export function isDefinitiveStripeRejection(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError ||
    err instanceof Stripe.errors.StripeCardError ||
    err instanceof Stripe.errors.StripePermissionError ||
    err instanceof Stripe.errors.StripeAuthenticationError
  );
}

/**
 * Normalize a Stripe error into the row's `failureCode` / `failureMessage`
 * fields: `err.code` when present (e.g. `balance_insufficient`), else the SDK
 * error class via `err.type` (e.g. `StripeInvalidRequestError`).
 */
export function stripeErrorFailureFields(
  err: unknown,
  fallbackMessage: string,
): { failureCode: string | null; failureMessage: string } {
  const anyErr = err as { code?: unknown; type?: unknown; message?: unknown };
  const failureCode =
    typeof anyErr?.code === "string"
      ? anyErr.code
      : typeof anyErr?.type === "string"
        ? anyErr.type
        : null;
  const failureMessage = String(anyErr?.message ?? fallbackMessage).slice(
    0,
    1024,
  );
  return { failureCode, failureMessage };
}
