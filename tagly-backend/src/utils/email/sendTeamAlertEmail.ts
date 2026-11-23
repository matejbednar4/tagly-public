import { resendClient } from "../clients/resend.js";
import { CONTACT } from "../../constants/platform/CONTACT.js";
import { TEAM_ALERT } from "../../constants/platform/TEAM_ALERT.js";
import { redis } from "../clients/redis.js";

/**
 * Send an internal operational alert to the Tagly team (withdrawals.md D4). This
 * is the only ops-alerting channel for the withdrawal flow — console logs are
 * write-only in prod and alert nobody, so anything a human must act on goes here.
 *
 * **Deduped across instances.** A `dedupeKey` is required: the first caller to
 * claim it in Redis sends, and every later call with the same key is skipped
 * until the window (`TEAM_ALERT.DEDUPE_WINDOW_MS`) expires. Scope the key per
 * (callsite + entity) — e.g. `payout-exhausted:${withdrawalUid}` — so a recurring
 * anomaly emails once per window while two distinct incidents each alert. Fails
 * OPEN: a Redis error sends anyway (a duplicate ops email beats a missed one).
 *
 * Best-effort by design: it never throws. It runs *after* the triggering
 * transaction has committed, so a send failure must not roll back or mask the
 * money movement that already happened; a failure is logged and swallowed.
 *
 * Kept deliberately minimal and self-contained (no versioned email templates) so
 * it needs none of the product-email chrome: plain HTML straight to the team inbox.
 */
export async function sendTeamAlertEmail(params: {
  subject: string;
  /** Plain lines rendered as <p> paragraphs, in order. */
  lines: string[];
  /**
   * Cross-instance throttle key — the same key won't re-alert within
   * `dedupeWindowMs`. Scope per (callsite + entity).
   */
  dedupeKey: string;
  /** Throttle window (ms). Defaults to `TEAM_ALERT.DEDUPE_WINDOW_MS`. */
  dedupeWindowMs?: number;
}): Promise<void> {
  const {
    subject,
    lines,
    dedupeKey,
    dedupeWindowMs = TEAM_ALERT.DEDUPE_WINDOW_MS,
  } = params;

  // Claim the key: `SET NX PX` returns "OK" only for the first caller in the
  // window; a null means someone already alerted, so skip. Fail open on any Redis
  // error — a missed money alert is worse than a duplicate.
  try {
    const claimed = await redis.set(
      `alert:${dedupeKey}`,
      "1",
      "PX",
      dedupeWindowMs,
      "NX",
    );
    if (claimed === null) return;
  } catch {
    // Redis unreachable — fall through and send.
  }

  const html = lines
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#382724;">${line}</p>`,
    )
    .join("");

  try {
    const { error } = await resendClient.emails.send({
      from: `Tagly Ops <${CONTACT.NOTIFICATIONS_FROM_EMAIL}>`,
      to: CONTACT.HEALTH_EMAIL,
      subject,
      html,
      // Same multipart rule as `sendEmail`: `lines` is already plain text, so
      // the text part is the source rather than a conversion of the HTML.
      text: lines.join("\n"),
      // Deliberately untagged (no env tag): team-mail engagement isn't
      // tracked. If a Resend webhook is ever re-added, its strict env filter
      // must keep dropping untagged events so ops mail stays out of analytics.
    });
    if (error) throw new Error(error.message);
  } catch (err) {}
}
