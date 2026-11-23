import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

/**
 * Lazily load `@react-native-google-signin/google-signin`. Unlike the expo
 * modules above (lazy native proxies), this package accesses its native module
 * (`RNGoogleSignin`) **at import time** via `getEnforcing`, so a top-level import
 * crashes any consumer that doesn't link it — e.g. the admin app, which pulls in
 * `@tagly/client` for the design system but never does Google sign-in. Requiring
 * it inside the two functions that use it means only apps that actually call
 * Google sign-in ever touch the native module (customer/advertiser, which link
 * it). Type via `typeof import(...)` so we keep full typing with no runtime load.
 */
function getGoogleSignin(): typeof import("@react-native-google-signin/google-signin") {
  return require("@react-native-google-signin/google-signin");
}

/**
 * Native Google / Apple sign-in, shared by both mobile apps.
 *
 * Each app calls {@link configureGoogleSignin} once at startup with its own
 * client IDs; the sign-in functions then return the provider's identity token
 * (plus nonce/fullName for Apple) for the backend `/v2/.../google|apple`
 * endpoints to verify.
 *
 * Native (iOS/Android) only — `@react-native-google-signin` has no web build,
 * so the advertiser web app will need a separate web sign-in flow.
 *
 * Each sign-in function returns `null` when the user cancels (a no-op for the
 * caller) and throws only on genuine errors.
 */

let googleConfigured = false;

/**
 * Configure the Google SDK once. `webClientId` is the server/web client ID whose
 * value becomes the ID token's `aud` (and must match the backend allowlist);
 * `iosClientId` enables the native iOS flow.
 */
export function configureGoogleSignin(opts: {
  webClientId: string;
  iosClientId?: string;
}): void {
  if (googleConfigured) return;
  const { GoogleSignin } = getGoogleSignin();
  GoogleSignin.configure({
    webClientId: opts.webClientId,
    iosClientId: opts.iosClientId,
  });
  googleConfigured = true;
}

/** Triggers Google sign-in. Returns the ID token, or `null` if cancelled. */
export async function signInWithGoogle(): Promise<{ idToken: string } | null> {
  const { GoogleSignin, statusCodes } = getGoogleSignin();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type === "cancelled") return null;
    const idToken = res.data?.idToken ?? null;
    if (!idToken) throw new Error("Google sign-in returned no ID token");
    return { idToken };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw e;
  }
}

/** Thrown when Apple sign-in isn't available on the device (e.g. Android). */
export class AppleSignInUnavailableError extends Error {
  constructor() {
    super("Apple sign-in is not available on this device");
    this.name = "AppleSignInUnavailableError";
  }
}

/**
 * Triggers Apple sign-in. Generates a random nonce, passes its SHA-256 hash to
 * Apple (Apple stores the hash in the token's `nonce` claim), and returns the
 * RAW nonce for the backend to hash + compare. `fullName` is only present on the
 * user's first authorization — Apple drops it on subsequent sign-ins. Returns
 * `null` if cancelled.
 */
export async function signInWithApple(): Promise<{
  identityToken: string;
  nonce: string;
  fullName: string | null;
} | null> {
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new AppleSignInUnavailableError();
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      throw new Error("Apple sign-in returned no identity token");
    }
    const fullName =
      [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim() || null;
    return { identityToken: credential.identityToken, nonce: rawNonce, fullName };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}
