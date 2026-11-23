import express, { Router } from "express";
import { stripePlatformWebhook } from "../../controllers/webhooks/stripe/stripePlatformWebhook.js";
import { stripeConnectWebhook } from "../../controllers/webhooks/stripe/stripeConnectWebhook.js";

const r = Router();

// Stripe signs the raw request body, so these must parse with express.raw()
// (never express.json()) to keep the untouched Buffer for signature verification.
r.post(
  "/platform",
  express.raw({ type: "application/json" }),
  stripePlatformWebhook,
);

r.post(
  "/connect",
  express.raw({ type: "application/json" }),
  stripeConnectWebhook,
);

export default r;
