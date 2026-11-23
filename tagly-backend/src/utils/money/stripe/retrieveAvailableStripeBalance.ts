import { stripe } from "../../clients/stripe.js";
import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";

/**
 * Fetches the platform's Stripe balance and subtracts all funds assigned to
 * advertisers, customers, and in-flight subsidized share locks, returning the
 * net unassigned amount available for new subsidized share locks.
 *
 * Pass an optional `tx` to run DB aggregations inside a transaction
 * (Stripe API call always runs outside).
 */
export async function retrieveAvailableStripeBalance(
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  const [stripeBalance, advertiserBudgets, customerBalances, platformBalance] =
    await Promise.all([
      stripe.balance.retrieve(),

      db.advertiserSensitiveData.aggregate({
        _sum: {
          availableBudgetUsdCents: true,
          lockedBudgetUsdCents: true,
        },
      }),

      db.customerSensitiveData.aggregate({
        _sum: {
          balanceUsdCents: true,
          lockedBalanceUsdCents: true,
        },
      }),

      db.platformBalance.findUnique({
        where: { id: 1 },
        select: { lockedUsdCents: true },
      }),
    ]);

  const stripeBalanceCents = stripeBalance.available.reduce((sum, entry) => {
    if (entry.currency === "usd") return sum + entry.amount;
    return sum;
  }, 0);

  const assignedToAdvertisersCents =
    Number(advertiserBudgets._sum.availableBudgetUsdCents ?? 0n) +
    Number(advertiserBudgets._sum.lockedBudgetUsdCents ?? 0n);

  const assignedToCustomersCents =
    Number(customerBalances._sum.balanceUsdCents ?? 0n) +
    Number(customerBalances._sum.lockedBalanceUsdCents ?? 0n);

  const lockedForSubsidizedSharesCents = Number(
    platformBalance?.lockedUsdCents ?? 0n,
  );

  const unassignedCents =
    stripeBalanceCents -
    assignedToAdvertisersCents -
    assignedToCustomersCents -
    lockedForSubsidizedSharesCents;

  return {
    stripeBalanceCents,
    assignedToAdvertisersCents,
    assignedToCustomersCents,
    lockedForSubsidizedSharesCents,
    unassignedCents,
  };
}
