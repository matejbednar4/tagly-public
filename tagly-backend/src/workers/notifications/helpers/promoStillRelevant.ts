import type { AccountType } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";
import { promoEventsRaw } from "../../../constants/catalogs/notifications/promoCatalog.js";

/**
 * Send-time re-check of a promo step's cadence predicate. The maintenance
 * schedulers check eligibility at QUEUE time, but quiet-hours snapping can hold
 * a job for up to ~35h (and the email waterfall leg for 24h more) — plenty of
 * time for the user to do the very thing the nudge asks for. Without this gate
 * a customer who just created their first share still gets "make your first
 * share" the next morning.
 *
 *   - firstShareNudge   → stale once the customer has ANY share (mirrors the
 *                         scheduler's `shares: { none: {} }`).
 *   - inactivityReminder → stale once a share exists newer than the step's
 *                         `minDays` threshold (they're no longer inactive at
 *                         this step's depth).
 *   - pendingCustomerNudge → nothing to re-check here: completing registration
 *                         deletes the PendingCustomer row, which the
 *                         `mayReceivePromo` existence gate already catches.
 *
 * Unknown slugs (non-promo) return true — this gate only ever suppresses.
 */
export async function promoStillRelevant(
  eventSlug: string,
  target: AccountType,
  recipientId: number,
): Promise<boolean> {
  const event = (
    promoEventsRaw as Record<string, (typeof promoEventsRaw)[keyof typeof promoEventsRaw]>
  )[eventSlug];
  if (!event) return true;

  const cadence = event.cadence;

  if (cadence.kind === "firstShareNudge") {
    if (target !== "CUSTOMER") return true;
    const share = await prisma.share.findFirst({
      where: { customerId: recipientId },
      select: { id: true },
    });
    return share === null;
  }

  if (cadence.kind === "inactivityReminder") {
    if (target !== "CUSTOMER") return true;
    const cutoff = new Date(
      Date.now() - cadence.minDays * 24 * 60 * 60 * 1000,
    );
    const recent = await prisma.share.findFirst({
      where: { customerId: recipientId, createdAt: { gt: cutoff } },
      select: { id: true },
    });
    return recent === null;
  }

  return true;
}
