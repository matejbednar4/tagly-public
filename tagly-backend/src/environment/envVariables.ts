import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";

const envPath = path.resolve(
  new URL(".", import.meta.url).pathname,
  "../../.env",
);
dotenv.config({ path: envPath });

// This schema is the boot-time gate for every environment variable: `safeParse`
// below `process.exit(1)`s on anything missing or malformed. That crash IS the
// point — it turns a silent misconfiguration in prod into a loud failure at
// startup. So **never mark a var `.optional()` (or give it a `.default()`) unless
// it is genuinely only ever set in dev**. Anything that must exist in prod stays
// non-optional, so a missing value fails fast here instead of surfacing as a
// broken request later. (The few legitimately-optional ones below —
// GOOGLE_SAFE_BROWSING_API_KEY, TESTER_* — say why in their comments.)
const envSchema = z.object({
  APP_STAGE: z.enum(["development", "staging", "production"]), // which env is this?

  API_BASE_URL: z.url(),
  PORT: z.string().default("8080"),

  AWS_REGION: z.string(),
  S3_BUCKET: z.string(),

  CDN_BASE_URL: z.url(),

  IG_CLIENT_ID: z.string(),
  IG_CLIENT_SECRET: z.string(),
  IG_TOKEN_ENC_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "Must be base64 32B",
    ),

  DATABASE_URL: z.url(),

  // Redis (ElastiCache Valkey) connection URL. Required in every environment,
  // including local dev (run a local Redis/Valkey) — so the client always exists
  // and consumers only ever fail open on a runtime *outage*, never on config.
  // `rediss://` in staging+prod (in-transit encryption), `redis://` locally.
  REDIS_URL: z.url(),

  JWT_SECRET: z.string(),

  // Google / Apple Sign-In — accepted ID-token audiences (the OAuth client IDs
  // for Google, the app bundle/service ids for Apple) the native SDKs request
  // tokens for. Comma-separated to allow multiple (e.g. iOS + Android + web for
  // Google). Required (min 1) so misconfiguration fails fast at boot rather than
  // at the first sign-in request — set in every environment (app + workers).
  GOOGLE_OAUTH_CLIENT_IDS: z.string().min(1),
  APPLE_OAUTH_CLIENT_IDS: z.string().min(1),

  RESEND_API_KEY: z.string(),

  // PostHog (backend error tracking — the node twin of the client analytics
  // project). REQUIRED in every env (incl. local dev): the backend must always
  // know where to ship errors, so a missing key fails fast at boot rather than
  // silently disabling tracking in prod. Same project as the clients; a global
  // `app: "backend"` super-property (stamped per event in reportError) keeps it
  // apart from `app: "customer"`/`"advertiser"`. HOST is explicit per env (mirror
  // the client's POSTHOG_HOST) so dev telemetry can't default into the prod project.
  POSTHOG_API_KEY: z.string(),
  POSTHOG_HOST: z.url(),


  // Google Safe Browsing — screens business-supplied links for malware/phishing
  // before they enter admin review (see utils/moderation/checkUrlSafety).
  // Optional: without it the safety check is skipped (links still go to admin
  // review), so the backend boots before the key is provisioned.
  GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string(),

  STRIPE_WEBHOOK_SECRET: z.string(), // locally you get this when you run stripe listen --forward-to localhost:{port}/webhooks/stripe/...
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string(), // locally you get this when you run stripe listen --forward-to localhost:{port}/webhooks/stripe/...

  STRIPE_API_VERSION_SERVER: z.string(),

  PASSWORD_PEPPER: z.string(),

  NOTIFICATION_UNSUBSCRIBE_SECRET: z.string(),

  // Store-review tester bypass: lets the single configured tester email log in
  // with a fixed OTP (TESTER_OTP) so Google Play / App Store reviewers can sign
  // in without receiving a real email OTP. Both must be set for the bypass to
  // activate; leave unset in environments where it shouldn't apply.
  TESTER_EMAIL: z.string().optional(),
  TESTER_OTP: z.string().optional(),

  // Minimum app version gate (semver per app — iOS/Android share the version, so
  // one threshold covers both platforms). A client below its minimum gets 426
  // CLIENT_OUTDATED → UpdateRequiredScreen. Default "0.0.0" gates nobody; raise it
  // per app to force a cutover (see middleware/security/enforceMinVersion.ts).
  MIN_CUSTOMER_VERSION: z
    .string()
    .regex(/^\d+(\.\d+)*$/, "Must be a numeric version, e.g. 2.1.0")
    .default("0.0.0"),
  MIN_ADVERTISER_VERSION: z
    .string()
    .regex(/^\d+(\.\d+)*$/, "Must be a numeric version, e.g. 2.1.0")
    .default("0.0.0"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  process.exit(1);
}

// ── Stage-dependent origins ─────────────────────────────────────────────────
// Pick a value by deploy stage; `development` points at locally-running services.
const byStage = <T>(opts: { production: T; staging: T; development: T }): T =>
  opts[parsed.data.APP_STAGE];

// Redirect page — converts web returns into the app's deep-link scheme on mobile.
// The page picks its scheme family by HOSTNAME (tagly hosts → tagly-*/v2
// schemes); the legacy *.flaer.app hosts keep resolving there forever per the
// additive-migration rule, but the backend no longer emits them — every
// shipped client is v2 and deep-links only off the tagly hosts. Stripe return
// URLs need no dashboard change (per-session URLs).
const REDIRECT_BASE_URL = byStage({
  production: "https://redirect.taglyapp.com",
  staging: "https://staging.redirect.tagly.dev",
  development: "https://dev.redirect.tagly.dev",
});

// Email unsubscribe link base — the host baked into every promo email's footer
// link AND its RFC 8058 `List-Unsubscribe` header.
//
// Staging/production use their own API host (the token is only verifiable by
// the environment that signed it). **Development deliberately points at
// STAGING**, not at localhost: `API_BASE_URL` in dev is a `.local` machine
// name with no port and no TLS, which produces a dead `http://` link inside a
// real email — bad for spam scoring, and plausibly why Apple's private relay
// stripped the `List-Unsubscribe` header off a dev send (2026-08-09).
//
// This is safe despite crossing environments because it **fails closed**:
// tokens are signed with NOTIFICATION_UNSUBSCRIBE_SECRET, which is per-env, so
// a dev-signed token presented to staging fails `jwt.verify` and the handler
// returns 200 + "Invalid link" with NO database write (verified 2026-08-09 —
// the dev and staging secrets differ). Production is never a target here, and
// must never be added: a staging email able to unsubscribe a real user is
// exactly the failure this shape avoids.
const UNSUBSCRIBE_BASE_URL = byStage({
  production: parsed.data.API_BASE_URL,
  staging: parsed.data.API_BASE_URL,
  development: "https://staging.api.tagly.dev",
});

// ── Derived URLs (built off the redirect base above) ────────────────────────
// Customer mobile redirect targets (Stripe Connect onboarding + Instagram OAuth).
// The redirect page turns `/customer/{rest}` into the app's `tagly://{rest}` deep
// link; Connect onboarding returns to `/customer/withdraw` so the user lands
// back on the withdraw screen. Advertiser billing is native PaymentSheet and
// needs no browser return URLs.
const CUSTOMER_APP_WITHDRAW_RETURN_URI = `${REDIRECT_BASE_URL}/customer/withdraw`;

// Instagram OAuth token-exchange `redirect_uri` — Meta (per RFC 6749 §4.1.3)
// requires it to be byte-identical to the `redirect_uri` the client authorized
// with, and that value is BAKED INTO each client bundle (`app.config.ts`), so
// this constant and the apps' value must move together. Registered in the Meta
// console (authorize leg).
const CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI = `${REDIRECT_BASE_URL}/customer/instagram/oauth`;

export const envVariables = {
  ...parsed.data,
  CUSTOMER_APP_WITHDRAW_RETURN_URI,
  CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI,
  UNSUBSCRIBE_BASE_URL,
};
