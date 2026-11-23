import type { AccountType } from "../../generated/prisma/client.js";
import prisma from "../../prisma/prisma.js";

/**
 * Stable pseudonymous analytics identifier for a notification recipient — the
 * account `uid` for real accounts (matching `reportError`'s distinctId
 * convention), `TARGET:id` for pending registrations (no uid exists; those
 * rows purge after 30 days). Raw sequential DB primary keys must not leave
 * the system (PostHog distinctIds, Resend tags) — the telemetry twin of the
 * W-10 rule on the Stripe side. Falls back to `TARGET:id` when the account
 * row is already gone (deleted between send and attribution).
 */
export async function resolveRecipientAnalyticsId(
  target: AccountType,
  id: number,
): Promise<string> {
  if (target === "CUSTOMER") {
    const c = await prisma.customer.findUnique({
      where: { id },
      select: { uid: true },
    });
    if (c) return c.uid;
  } else if (target === "ADVERTISER") {
    const a = await prisma.advertiser.findUnique({
      where: { id },
      select: { uid: true },
    });
    if (a) return a.uid;
  }
  return `${target}:${id}`;
}
