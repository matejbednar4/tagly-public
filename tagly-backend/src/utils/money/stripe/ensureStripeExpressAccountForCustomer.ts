import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { stripe } from "../../clients/stripe.js";

/**
 * Ensures a customer has a Stripe Express Connect account.
 *
 * If the customer already has a stripeConnectId, returns it immediately.
 * Otherwise, creates a new Express account in Stripe and stores the ID.
 *
 * The Express account's country is derived from the customer's `locale`
 * (ISO alpha-2). Stripe Connect supports holding USD balances on non-US
 * accounts, so platform → connect transfers stay in USD regardless of
 * country and Stripe handles the payout-side FX into the local bank.
 *
 * NOTE: cross-border payouts (US platform → non-US connect) must be
 * enabled in the Stripe dashboard per region. Onboarding a new locale
 * requires flipping that toggle before users can complete KYC.
 */
export async function ensureStripeExpressAccountForCustomer(
  customerId: number,
): Promise<string> {
  // First, quick check - most calls will hit this path
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      email: true,
      fullName: true,
      locale: true,
      sensitiveData: {
        select: { stripeConnectId: true },
      },
    },
  });

  if (!existing) {
    throw createCustomError(1401, "customer not found", 404);
  }

  if (existing.sensitiveData?.stripeConnectId) {
    return existing.sensitiveData.stripeConnectId;
  }

  // No existing account - create one
  const email = existing.email ?? undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;

  if (existing.fullName) {
    const parts = existing.fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
  }

  // Non-US Express accounts requesting only `transfers` must use the
  // `recipient` service agreement (otherwise Stripe demands `card_payments`
  // too, which doesn't apply — our customers only receive payouts). The
  // US flow keeps the default `full` agreement to avoid changing terms
  // for existing-region onboardings.
  const isNonUs = existing.locale !== "US";

  const account = await stripe.accounts.create({
    type: "express",
    country: existing.locale,
    business_type: "individual",
    email,
    capabilities: { transfers: { requested: true } },

    // Platform-controlled payouts: Stripe never auto-pays the connected balance —
    // we create + reconcile a standard payout per withdrawal ourselves (so each
    // payout carries our metadata and the webhooks/worker can track it). Without
    // this, Stripe's default automatic payouts sweep the balance with no metadata
    // and withdrawals would never reconcile to PAID_OUT.
    settings: { payouts: { schedule: { interval: "manual" } } },

    business_profile: {
      product_description:
        "Individual using Tagly to earn rewards for advertising on their social media.",
      support_email: email,
    },
    individual:
      firstName || lastName || email
        ? {
            first_name: firstName,
            last_name: lastName,
            email,
          }
        : undefined,
    ...(isNonUs && {
      tos_acceptance: { service_agreement: "recipient" },
    }),
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      sensitiveData: {
        update: {
          stripeConnectId: account.id,
        },
      },
    },
  });

  return account.id;
}
