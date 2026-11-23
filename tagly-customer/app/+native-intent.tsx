/**
 * Intercepts native deep link URLs before Expo Router matches them to routes.
 *
 * AppsFlyer OneLink URLs (e.g., tagly.onelink.me/fxW4/default)
 * and redirect domain URLs open the app via Universal Links, but their paths
 * don't correspond to any app route. Without this file, they'd hit +not-found
 * and get stuck on the splash screen.
 *
 * The referral code is still captured by the AppsFlyer SDK (onDeepLink callback
 * in appsFlyerBridge.ts) — we just need to redirect the routing to "/" so the
 * normal index flow handles auth checking and shows the landing page.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // OneLink and redirect domain URLs have paths like /xSXI/p9vthla4 or /customer/callback
  // that don't match any app route. Redirect everything that isn't a known app route to "/".
  const knownPrefixes = ["/(app)", "/(onboarding)", "/(tabs)"];
  const isKnownRoute =
    path === "/" || knownPrefixes.some((prefix) => path.startsWith(prefix));

  if (!isKnownRoute) {
    return "/";
  }

  return path;
}
