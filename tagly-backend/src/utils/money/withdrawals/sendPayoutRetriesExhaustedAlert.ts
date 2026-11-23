import { reportError } from "../../core/errors/reportError.js";

/**
 * D4 ops escalation: a withdrawal's payout has failed its final allowed attempt,
 * so automatic retries are exhausted and the money is parked on the customer's
 * Connect balance (row stays DELAYED). Routed through `reportError` with
 * `notify` — the incident lands in PostHog AND emails the team (deduped) so a
 * human can follow up — there is no auto-reverse-to-balance yet. Called by both
 * the Connect webhook and the worker poll pass, **after** their transaction
 * commits, and only on the single exhaustion edge (the failure that reaches max
 * attempts), so it fires once per withdrawal. Best-effort (`reportError` never
 * throws).
 */
export function sendPayoutRetriesExhaustedAlert(withdrawalUid: string): void {
  reportError(
    `Withdrawal ${withdrawalUid} has exhausted all automatic payout attempts`,
    {
      source: "system",
      errorClass: "permanent",
      service: "stripe",
      withdrawalUid,
      notify: true,
      notifyKey: `payout-retries-exhausted:${withdrawalUid}`,
      notifyLines: [
        "The funds are sitting on the customer's Stripe Connect balance and no further timed retry is scheduled (the row stays DELAYED).",
        "If the customer fixes their payout account, Stripe's payouts-re-enabled signal triggers one automatic retry (D4 amendment) — another failure re-sends this alert.",
        "Otherwise manual follow-up is needed: check the connected account's payout requirements in Stripe, then re-trigger a payout once resolved.",
      ],
    },
  );
}
