import type { NextConfig } from "next";

const ALLOWED_ENVS = ["development", "staging", "production"];
const appEnv = process.env.APP_ENV;

if (!appEnv) {
  throw new Error("Missing required environment variable: APP_ENV");
}
if (!ALLOWED_ENVS.includes(appEnv)) {
  throw new Error("APP_ENV must be one of development, staging, production");
}

// Backend API base (public endpoints: QR-sticker resolution, public stats).
// Required + inlined at build time — Amplify SSR compute doesn't reliably
// expose runtime env vars, so build-time inlining (same as APP_ENV) is the
// dependable path. Set per env: prod https://api.taglyapp.com, staging
// https://staging.api.tagly.dev (Amplify branch-level override), local dev
// whatever backend you're running against (tagly-join/.env).
const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl || !/^https?:\/\//.test(apiBaseUrl)) {
  throw new Error(
    "Missing/invalid required environment variable: API_BASE_URL",
  );
}

// PostHog. `NEXT_PUBLIC_*` is inlined at build time, and PostHogTracker no-ops
// when the key is absent — so without this check a deploy that lost the var
// would silently stop tracking every sticker scan with no runtime signal.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!posthogKey) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_POSTHOG_KEY",
  );
}
// Anything in NEXT_PUBLIC_* ships in the public client bundle, so only the
// publishable phc_* project key may go here — never a personal API key.
if (!posthogKey.startsWith("phc_")) {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_KEY must be the publishable phc_* project key",
  );
}

const nextConfig: NextConfig = {
  env: {
    APP_ENV: appEnv,
    API_BASE_URL: apiBaseUrl.replace(/\/+$/, ""),
  },
  // Dev-only: `next dev` serves the HTML to any host but 403s every
  // /_next/* resource whose Origin isn't localhost, so opening the dev
  // server from a phone on the same Wi-Fi (http://<mac-lan-ip>:3000) yields
  // an unstyled, script-less page. Allow the private LAN ranges so real-device
  // testing works. Ignored entirely by `next build`/`next start`.
  // `*` matches a single segment only, so each 172.16-31 block is listed
  // explicitly (172.20.x is what an iPhone Personal Hotspot hands out).
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "*.local",
  ],
  rewrites: async () => [
    {
      source: "/:code",
      destination: "/?code=:code",
    },
  ],
  // The AASA file is extension-less, so Next would serve it as
  // application/octet-stream; Apple's CDN wants application/json. (Public
  // files are matched before the /:code rewrite, so /.well-known/* is safe.)
  //
  // ⚠️ This rule does NOT take effect on Amplify. Next.js `public/` assets are
  // uploaded to S3 and served by CloudFront directly, bypassing the compute
  // layer, so `headers()` never runs for them — staging was observed serving
  // `application/octet-stream` despite this config (2026-08-04). The hosting
  // layer sets it instead: see `customHttp.yml` in this folder. Keep this rule
  // anyway — it is what makes `next dev`/`next start` and any self-hosted
  // deployment correct.
  headers: async () => [
    {
      source: "/.well-known/apple-app-site-association",
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
  ],
};

export default nextConfig;
