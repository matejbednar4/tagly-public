import type { WithdrawalPurpose } from "../../../generated/prisma/client.js";

/**
 * The single source of truth for the withdrawal `purpose` vocabulary across its
 * two representations:
 *  - **DB enum** `WithdrawalPurpose` — UPPER_SNAKE per Prisma convention
 *    (`CUSTOMER_WITHDRAWAL` / `ACCOUNT_DELETION_SWEEP`).
 *  - **Wire form** — lower snake_case per Stripe's metadata idiom
 *    (`customer_withdrawal` / `account_deletion_sweep`), used in Stripe
 *    `metadata.purpose` AND embedded in the deterministic idempotency keys
 *    (`withdraw:{uid}:transfer:{purpose}:v1`, `…:payout:standard:{purpose}:…`).
 *
 * ⚠️ The wire strings are a **frozen contract**: they live inside idempotency
 * keys of already-created Stripe objects and in metadata the webhook handlers
 * gate on. Never change the values — this module exists so every writer
 * (orchestrator, payout util, worker) and reader (webhook handlers) shares one
 * definition and a mismatch is structurally impossible.
 */
export const WITHDRAWAL_PURPOSE_WIRE = {
  CUSTOMER_WITHDRAWAL: "customer_withdrawal",
  ACCOUNT_DELETION_SWEEP: "account_deletion_sweep",
} as const satisfies Record<WithdrawalPurpose, string>;

export type WithdrawalPurposeWire =
  (typeof WITHDRAWAL_PURPOSE_WIRE)[WithdrawalPurpose];

/** DB enum → Stripe wire form (metadata + idempotency keys). */
export function toWireWithdrawalPurpose(
  purpose: WithdrawalPurpose,
): WithdrawalPurposeWire {
  return WITHDRAWAL_PURPOSE_WIRE[purpose];
}

/** Stripe wire form → DB enum (row creation). */
export function toDbWithdrawalPurpose(
  wire: WithdrawalPurposeWire,
): WithdrawalPurpose {
  return wire === "account_deletion_sweep"
    ? "ACCOUNT_DELETION_SWEEP"
    : "CUSTOMER_WITHDRAWAL";
}

/**
 * Parse an untrusted `metadata.purpose` value from a Stripe object. Returns
 * null for anything that isn't ours — the webhook handlers use this as the
 * "is this payout/transfer one of Tagly's withdrawal objects?" gate (the
 * Connect webhook sees every payout on every connected account, including ones
 * we didn't create).
 */
export function parseWireWithdrawalPurpose(
  value: unknown,
): WithdrawalPurposeWire | null {
  return value === "customer_withdrawal" || value === "account_deletion_sweep"
    ? value
    : null;
}
