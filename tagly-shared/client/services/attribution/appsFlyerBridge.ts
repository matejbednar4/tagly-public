import * as Linking from "expo-linking";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { localStore } from "../storage/localStorage";
import { SHARED_LOCAL_KEYS } from "../storage/keys";
import { resolveInboundReferral } from "./parseInboundReferral";

const { APPSFLYER_DEV_KEY, APPLE_APP_ID } = (Constants.expoConfig?.extra ??
  {}) as any;

// AppsFlyer is only wired for apps that configure it — customer/advertiser set
// `APPSFLYER_DEV_KEY` in their `app.config` `extra`; admin has no AppsFlyer. Guard
// the require: `react-native-appsflyer`'s module-eval builds a `NativeEventEmitter`
// from its native module, which throws (`requires a non-null argument`) in an app
// that doesn't link it. No key → don't load it (and the listener/init blocks below
// are already `appsFlyer`-gated, so they no-op too). Also skipped on web.
const appsFlyer =
  Platform.OS !== "web" && APPSFLYER_DEV_KEY
    ? require("react-native-appsflyer").default
    : null;

function withIdPrefix(id?: string) {
  if (!id) return undefined;
  return id.startsWith("id") ? id : `id${id}`;
}

// Read a referral code out of a URL that came from an AppsFlyer payload field
// (`af_dp`). These are AppsFlyer-authored links, so a bare `?code=` is trustworthy
// here — unlike an arbitrary inbound OS url, which goes through the host-aware
// `parseInboundReferral` instead (see that file for why).
function extractCodeFromUrl(url?: string | null): string | undefined {
  if (!url) return;
  try {
    const safe = url.replace(/^([a-z-]+):\/\//i, "scheme://");
    const u = new URL(safe);
    const code =
      u.searchParams.get("code") ??
      u.searchParams.get("deep_link_value") ??
      undefined;

    return code ?? undefined;
  } catch (err) {
    return;
  }
}

// Pull a referral code out of an AppsFlyer payload — from `af_dp` (?code=),
// `deep_link_value`, or a direct code field. Returns the code or undefined.
function extractCodeFromAfPayload(payload: any): string | undefined {
  const p = payload?.data ?? payload?.deepLink ?? payload ?? {};

  const deepLinkValue: string | undefined =
    p.deep_link_value ?? p.deepLinkValue ?? p.deeplinkValue;
  const afDp: string | undefined =
    p.af_dp ?? p.afDp ?? p.af_deeplink ?? p.af_deeplink_url;
  const directCode: string | undefined =
    p.code ?? p.referral ?? p.ref ?? p.r ?? p.af_sub1;

  return (
    extractCodeFromUrl(afDp)?.trim() ||
    deepLinkValue?.trim() ||
    directCode?.trim() ||
    undefined
  );
}

// Persist the most recent referral code for later attribution — read by
// attach-referrer during onboarding, cleared on sign-in. LAST WRITE WINS: a
// later code (URL open or AppsFlyer payload, whichever fires) overwrites an
// earlier one. The guard means we only ever write when a real code exists, so a
// payload without one never clobbers a previously captured code.
// NOTE: deliberately NOT gated on "is there a JWT". A signed-in check was tried and
// reverted: iOS Keychain entries survive app deletion, so a reinstall-from-a-referral-
// link still sees the old session's JWT and the guard would drop a legitimate new
// install's attribution — the exact case attribution exists for. Staleness is handled
// on the consuming side instead: both apps delete REFERRAL_PREFILL in `signIn`, so a
// code can never outlive the registration it was captured for.
async function stashReferralCode(code?: string | null) {
  if (!code) return;
  await localStore(SHARED_LOCAL_KEYS.REFERRAL_PREFILL, String(code));
}

/** ---- Listeners FIRST (so native events don't beat us) ------------------ */

// AppsFlyer listeners - only on native platforms
let offInstall: (() => void) | undefined;
let offDeep: (() => void) | undefined;

if (Platform.OS !== "web" && appsFlyer) {
  // Deferred deep link (post-install first open)
  offInstall = appsFlyer.onInstallConversionData(async (payload: any) => {
    try {
      await stashReferralCode(extractCodeFromAfPayload(payload));
    } catch (err) {}
  });

  // Direct deep link (app already installed)
  offDeep = appsFlyer.onDeepLink(async (payload: any) => {
    try {
      await stashReferralCode(extractCodeFromAfPayload(payload));
    } catch (err) {}
  });
}

// Also capture direct URL opens that may bypass AF — a Universal Link straight into
// the app (join hosts are claimed with `paths: ["*"]`, so the join page never loads and
// its server-side `/:code` rewrite never runs), a raw scheme, or testing.
//
// These go through `resolveInboundReferral`, which is HOST-AWARE: it reads the pretty
// path form (`join.taglyapp.com/<code>`), resolves QR stickers (`?id=`) via the public
// API, and — critically — refuses to treat a bare `?code=` on a redirect host as a
// referral, because that is the Instagram OAuth authorization code.
Linking.getInitialURL()
  .then(async (url) => stashReferralCode(await resolveInboundReferral(url)))
  .catch((err) => {});

Linking.addEventListener("url", async ({ url }) => {
  await stashReferralCode(await resolveInboundReferral(url));
});

/** ---- THEN init the AppsFlyer SDK -------------------------------------- */

/// <reference types="expo" />
if (Platform.OS !== "web" && appsFlyer) {
  const devKey = APPSFLYER_DEV_KEY;
  const appId = Platform.OS === "ios" ? withIdPrefix(APPLE_APP_ID) : undefined;

  appsFlyer.initSdk(
    {
      devKey,
      ...(Platform.OS === "ios" ? { appId } : {}),
      isDebug: __DEV__,
      onInstallConversionDataListener: true,
      onDeepLinkListener: true,
    },
    (res: any) => {},
    (err: any) => {}
  );
}

/* Optional cleanup helper (rarely needed in app runtime) */
export function cleanupAppsFlyer() {
  try {
    offInstall && offInstall();
  } catch (err) {}
  try {
    offDeep && offDeep();
  } catch (err) {}
}
