import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";

/**
 * Returns the advertiser's Stripe customer id, creating the Stripe customer (and
 * persisting it on AdvertiserSensitiveData) if one doesn't exist yet.
 *
 * Shared by the credit-purchase PaymentIntent and the PAYG card-link SetupIntent.
 */
export async function ensureStripeCustomerForAdvertiser(
  advertiserId: number,
): Promise<string> {
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      email: true,
      id: true,
      uid: true,
      sensitiveData: { select: { id: true, stripeCustomerId: true } },
    },
  });
  if (!advertiser) throw createCustomError(1304, "advertiser not found", 404);

  if (advertiser.sensitiveData.stripeCustomerId) {
    return advertiser.sensitiveData.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: advertiser.email,
    metadata: {
      advertiserId: String(advertiser.id),
      advertiserUid: advertiser.uid,
    },
  });

  await prisma.advertiserSensitiveData.update({
    where: { id: advertiser.sensitiveData.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
