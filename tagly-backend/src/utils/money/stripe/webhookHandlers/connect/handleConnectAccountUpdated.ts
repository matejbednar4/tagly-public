import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import { PendingCustomerNotification } from "../types.js";
import { scheduleImmediatePayoutRetryForAccount } from "../../../withdrawals/withdrawalTransitions.js";

export async function handleConnectAccountUpdated(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<PendingCustomerNotification> {
  const acc = event.data.object as Stripe.Account;

  const owner = await tx.customerSensitiveData.findFirst({
    where: { stripeConnectId: acc.id },
    select: {
      payoutsEnabledAt: true,
      customer: { select: { id: true } },
    },
  });

  if (!owner || !owner.customer?.id) {
    return null;
  }

  const customerId = owner.customer.id;

  // Payouts just enabled
  if (acc.payouts_enabled && !owner.payoutsEnabledAt) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        sensitiveData: {
          update: { payoutsEnabledAt: new Date() },
        },
      },
    });

    // W-1 fast-retry: the customer likely just fixed the bank details that were
    // making payouts fail, so bring any DELAYED withdrawals on this account
    // forward for an immediate retry instead of waiting out the backoff.
    await scheduleImmediatePayoutRetryForAccount(tx, { stripeAccountId: acc.id });

    return {
      eventSlug: "c.account.payouts-enabled",
      payload: {
        customerId,
        stripeAccountId: acc.id,
      },
      dedupeKey: `payouts-enabled:${customerId}:${event.id}`,
      customerIds: [customerId],
    };
  }

  // Payouts disabled (was enabled, now disabled)
  if (!acc.payouts_enabled && owner.payoutsEnabledAt) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        sensitiveData: {
          update: { payoutsEnabledAt: null },
        },
      },
    });

    return {
      eventSlug: "c.account.payouts-disabled",
      payload: {
        customerId,
        stripeAccountId: acc.id,
        reason:
          acc.requirements?.currently_due?.join(", ") ??
          "verification_required",
      },
      dedupeKey: `payouts-disabled:${customerId}:${event.id}`,
      customerIds: [customerId],
    };
  }

  // No change relevant to our schema
  return null;
}
