import "react-native-get-random-values";
import "@tagly/client";
import "@/i18n/appLocales";
import { StyleSheet, Platform, StatusBar } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useAssets } from "expo-asset";
import { STEP_ARTWORK } from "@/components/onboarding/Welcome";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  customFonts,
  useTheme,
  AppToast,
  UpdateRequiredScreen,
  setAlertFn,
  setOnUpdateRequired,
  composeProviders,
  configureGoogleSignin,
  customAlert,
  usePushOpenedListener,
  UserPreferencesProvider,
  CurrentLocationProvider,
} from "@tagly/client";
import TaglyDesignBridge from "@/providers/DesignBridge";
import Ionicons from "@expo/vector-icons/Ionicons";
import { initSdk } from "@tagly/sdk/shared";
import * as Application from "expo-application";
import { useState, useEffect } from "react";
import Constants from "expo-constants";
import { useAnalytics, useScreenTracking } from "@/utils/analytics";
import { PostHogProvider } from "posthog-react-native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SessionProvider, useSession } from "@/contexts/session/SessionContext";
import { OtpSessionProvider } from "@/contexts/otp/OtpSessionContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// Initialize SDK once at app load
initSdk({
  client: "advertiser",
  version: Application.nativeApplicationVersion ?? "0.0.0",
  build: Application.nativeBuildVersion ?? "1",
  platform: Platform.OS === "ios" ? "ios" : "android",
});

// Register custom alert to break require cycle between utils and design
setAlertFn(customAlert);

const {
  APP_STORE_URL,
  PLAY_STORE_URL,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  APP_ENV,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_MERCHANT_ID,
} = Constants.expoConfig?.extra as {
  APP_STORE_URL: string;
  PLAY_STORE_URL: string;
  POSTHOG_API_KEY: string;
  POSTHOG_HOST: string;
  APP_ENV: string;
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_MERCHANT_ID: string;
};

// The app scheme, for Stripe's 3DS/bank-redirect return into the app.
const appScheme = Constants.expoConfig?.scheme;
const stripeUrlScheme = Array.isArray(appScheme) ? appScheme[0] : appScheme;

// Configure Google Sign-In once at load (native only). webClientId is the token
// audience; iosClientId enables iOS. Guarded because the advertiser's own OAuth
// client IDs + the app.config.ts Google/Apple native config still need to be
// provided (see v2.0.0.md §3A "Auth"): until GOOGLE_WEB_CLIENT_ID is set in
// `extra`, the email/OTP path works fully and the Google button surfaces a
// "couldn't sign in" toast rather than crashing at boot.
if (GOOGLE_WEB_CLIENT_ID) {
  configureGoogleSignin({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
}

const postHogOptions = {
  host: POSTHOG_HOST,
  defaultOptIn: true,
  // Anonymous product analytics — no identify(), no PII. Same posture as the
  // customer app.
  personProfiles: "identified_only" as const,
  captureAppLifecycleEvents: true,
  customAppProperties: (properties: Record<string, unknown>) => ({
    ...properties,
    app_env: APP_ENV,
    // Stamps every event with the source app so customer + advertiser share ONE
    // PostHog project (filter/break down by `app`). Mirrors the customer's
    // `app: "customer"`. Do NOT split into two projects/providers.
    app: "advertiser",
  }),
};

/** All global providers, flattened (outermost first). */
const AppProviders = composeProviders([
  {
    provider: PostHogProvider,
    props: {
      apiKey: POSTHOG_API_KEY,
      options: postHogOptions,
      // captureScreens can't reach expo-router's NavigationContainer, so it's a
      // no-op here — we capture screens manually via useScreenTracking() instead.
      autocapture: { captureScreens: false, captureTouches: false },
    },
  },
  {
    provider: GestureHandlerRootView,
    props: { style: StyleSheet.absoluteFillObject },
  },
  {
    provider: SafeAreaProvider,
    props: { initialMetrics: initialWindowMetrics },
  },
  // Powers cross-platform keyboard handling (KeyboardAwareScrollView in the
  // business-page forms). Must wrap any screen that uses the lib's components.
  { provider: KeyboardProvider },
  { provider: TaglyDesignBridge },
  // Native PaymentSheet host (credit purchase + PAYG card-link). The merchant
  // id enables Apple Pay (entitlement written by the Stripe config plugin).
  {
    provider: StripeProvider,
    props: {
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      merchantIdentifier: STRIPE_MERCHANT_ID,
      urlScheme: stripeUrlScheme,
    },
  },
  { provider: CurrentLocationProvider },
  { provider: UserPreferencesProvider },
  { provider: QueryClientProvider, props: { client: queryClient } },
  // SessionProvider must sit inside QueryClientProvider — it clears the query
  // cache on sign-in/out.
  { provider: SessionProvider },
  // App-wide OTP send/cooldown tracker (gates the onboarding resend button).
  { provider: OtpSessionProvider },
]);

/**
 * Root layout. Mounts the global providers (see `AppProviders`) and the
 * navigation stack. Theming is the new `@tagly/client` theme (always Cream for
 * now — see v2.0.0.md).
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...customFonts, ...Ionicons.font });
  // Preload the onboarding step artwork behind the splash (the carousel is the
  // first screen a new user sees — without this, slides flash in as each image
  // loads). `useAssets` reports errors separately; on error we proceed anyway
  // rather than holding the splash forever over a non-critical image. Mirrors
  // the customer root layout.
  const [artwork, artworkError] = useAssets(STEP_ARTWORK);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    // Show the update gate on CLIENT_OUTDATED (426) responses.
    setOnUpdateRequired(() => setUpdateRequired(true));
  }, []);

  if (!fontsLoaded || (!artwork && !artworkError)) return null;

  return (
    <AppProviders>
      <ThemedStatusBar />
      {updateRequired ? (
        <UpdateRequiredScreen
          storeUrl={Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL}
        />
      ) : (
        <RootNavigator />
      )}
      {/* Dev-only floating reset — replay onboarding/setup (no-op in release). */}
      <AppToast />
    </AppProviders>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return (
    <StatusBar barStyle="dark-content" backgroundColor={theme.color.background} />
  );
}

/**
 * Boot + route guard. Holds the splash until the session is resolved, then gates
 * `(app)` vs `(onboarding)` on JWT presence via `Stack.Protected`. With no
 * `app/index.tsx`, `/` resolves into whichever group is unlocked.
 */
function RootNavigator() {
  const { theme } = useTheme();
  const { jwt, ready } = useSession();
  const { track } = useAnalytics();

  // Passive per-screen analytics — fires a PostHog `$screen` on every route
  // change (route pattern, no id leakage). Mounted here so it's inside both the
  // PostHog provider and the router.
  useScreenTracking();

  // Push-tap "open" tracking — the only observable push open signal. Mounted
  // here so it sits inside the PostHog provider and OUTSIDE the auth gate (a
  // pending advertiser tapping an onboarding nudge counts too). Deliberately
  // does NOT route anywhere — push deep linking is deferred (v2.0.0.md
  // §Notifications).
  usePushOpenedListener((data) => {
    track("push_opened", {
      slug: typeof data.slug === "string" ? data.slug : null,
    });
  });

  // Hide the splash once the session is resolved; 6s safety net regardless.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    const timeout = setTimeout(() => SplashScreen.hideAsync(), 6000);
    return () => clearTimeout(timeout);
  }, []);

  // Hold (splash visible) until we know whether there's a JWT, so we never flash
  // the onboarding group before resolving an existing session.
  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle: { backgroundColor: theme.color.background },
      }}
    >
      <Stack.Protected guard={!!jwt}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!jwt}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}
