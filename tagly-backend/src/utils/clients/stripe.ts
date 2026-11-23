import Stripe from "stripe";
import { envVariables } from "../../environment/envVariables.js";

export const stripe = new Stripe(envVariables.STRIPE_SECRET_KEY, {
  apiVersion: envVariables.STRIPE_API_VERSION_SERVER as any,
});
