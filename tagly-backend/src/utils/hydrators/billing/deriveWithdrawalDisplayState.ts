import type {
  WithdrawalDisplayState,
  WithdrawalStatus,
} from "@tagly/models/shared";
import type { WithdrawalPayoutStatus } from "../../../generated/prisma/client.js";

/**
 * Collapse a `StripeWithdrawal`'s raw, overloaded ledger `status` plus its
 * separate payout-leg `payoutStatus` into the single customer-facing
 * `WithdrawalDisplayState` the transactions feed renders.
 *
 * Why this exists: the raw `status` lies. A withdrawal is created PENDING, the
 * Stripe **transfer** moves money out of the Tagly balance synchronously, and the
 * payout-to-bank settles later via webhooks — but a **failed payout keeps the row
 * PENDING** (the money already left the platform; only `payoutStatus` flips to
 * FAILED/CANCELED), and `COMPLETED`/`REVERSED` are the only ledger-terminal
 * states. So `status` alone can't tell "on its way" from "stuck at the bank
 * step" — `payoutStatus` supplies that. This is the one place the mapping lives,
 * so the feed and any other reader can't disagree.
 *
 * Mapping (see `WithdrawalDisplayState` for the customer meaning):
 *  - FAILED    → FAILED      (transfer never went; balance restored in full)
 *  - REVERSED  → REVERSED    (transfer clawed back; balance credited back)
 *  - COMPLETED → PAID_OUT    (payout reached the bank)
 *  - PENDING + payoutStatus FAILED|CANCELED → DELAYED  (money left the balance
 *              but Stripe couldn't pay it into the bank; often fixable)
 *  - PENDING + payoutStatus NONE, **parked** → DELAYED (see below)
 *  - PENDING otherwise → PROCESSING
 *  - CANCELED  → FAILED      (never produced today; nothing left the balance)
 *
 * **Parked** = `payoutAttempts > 0 && nextPayoutRetryAt === null` while no
 * payout object exists (payoutStatus NONE): every payout **create** attempt was
 * rejected and no further attempt is scheduled — either the W-19 ladder
 * exhausted or `parkPayoutRetries` gave up (D4: parked money is a human's job).
 * In this state machine every *live* create-side row has either a scheduled
 * retry (`nextPayoutRetryAt` set — backoff, ambiguous recheck, or W-21
 * funds-availability deferral) or a payout in flight (payoutStatus IN_FLIGHT),
 * so this condition is reachable only by parking. To the customer it is identical to a failed payout — the money left
 * their balance and cannot reach their bank without action — so it renders
 * DELAYED, not a false "on its way". When an account-fix event re-arms the row
 * (`scheduleImmediatePayoutRetryForAccount` sets `nextPayoutRetryAt`), the
 * condition clears and the row correctly shows PROCESSING for the granted
 * attempt. The parked condition is deliberately derived here from the retry
 * schedule instead of writing `payoutStatus = FAILED` on create failures: the
 * payout leg only ever describes real payout objects, and mislabelling it would
 * move the row into the W-1 retry pass (keyed on payoutStatus FAILED|CANCELED,
 * no attempts cap by design).
 */
export function deriveWithdrawalDisplayState(input: {
  status: WithdrawalStatus;
  payoutStatus: WithdrawalPayoutStatus;
  payoutAttempts: number;
  nextPayoutRetryAt: Date | null;
}): WithdrawalDisplayState {
  switch (input.status) {
    case "COMPLETED":
      return "PAID_OUT";
    case "REVERSED":
      return "REVERSED";
    case "FAILED":
    case "CANCELED":
      return "FAILED";
    case "PENDING":
    default: {
      if (
        input.payoutStatus === "FAILED" ||
        input.payoutStatus === "CANCELED"
      ) {
        return "DELAYED";
      }
      const parked =
        input.payoutStatus === "NONE" &&
        input.payoutAttempts > 0 &&
        input.nextPayoutRetryAt === null;
      return parked ? "DELAYED" : "PROCESSING";
    }
  }
}
