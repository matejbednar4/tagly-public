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
  customAlert,
  customFonts,
  useTheme,
  AppToast,
  UpdateRequiredScreen,
} from "@tagly/client";
import TaglyDesignBridge from "@/providers/DesignBridge";
import Ionicons from "@expo/vector-icons/Ionicons";
import { initSdk } from "@tagly/sdk/shared";
import * as Application from "expo-application";
import { useState, useEffect } from "react";
import {
  setAlertFn,
  setOnUpdateRequired,
  composeProviders,
  configureGoogleSignin,
  usePushOpenedListener,
  UserPreferencesProvider,
  CurrentLocationProvider,
} from "@tagly/client";
import Constants from "expo-constants";
import { useAnalytics, useScreenTracking } from "@/utils/analytics";
import { setAudioModeAsync } from "expo-audio";
import { PostHogProvider } from "posthog-react-native";
import { AndroidInstagramAuthProvider } from "@/contexts/instagram/AndroidInstagramAuthContext";
import { SessionProvider, useSession } from "@/contexts/session/SessionContext";
import { OtpSessionProvider } from "@/contexts/otp/OtpSessionContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// Initialize SDK once at app load
initSdk({
  client: "customer",
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
} = Constants.expoConfig?.extra as {
  APP_STORE_URL: string;
  PLAY_STORE_URL: string;
  POSTHOG_API_KEY: string;
  POSTHOG_HOST: string;
  APP_ENV: string;
  GOOGLE_WEB_CLIENT_ID: string;
  GOOGLE_IOS_CLIENT_ID: string;
};

// Configure Google Sign-In once at load (native only — the customer app has no
// web target). webClientId is the token audience; iosClientId enables iOS.
configureGoogleSignin({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

const postHogOptions = {
  host: POSTHOG_HOST,
  defaultOptIn: true,
  // Anonymous product analytics: events never spawn a person profile unless we
  // ever explicitly call identify() — which we never do. Keeps onboarding/funnel
  // analytics first-party + anonymous (legitimate-interest basis, no consent
  // screen, nothing stored server-side). Do NOT add identify()/PII here.
  personProfiles: "identified_only" as const,
  // Passive engagement signal: Application Opened / Became Active / Backgrounded
  // (the DAU / retention / session-length denominator). Default is already true;
  // pinned explicitly so it can't be lost. No PII — lifecycle events only.
  captureAppLifecycleEvents: true,
  customAppProperties: (properties: Record<string, unknown>) => ({
    ...properties,
    app_env: APP_ENV,
    // Stamps every event with the source app so customer + advertiser can share
    // ONE PostHog project (filter/break down by `app` — no per-event work, no
    // name prefixes). The advertiser app must mirror this with `app: "advertiser"`
    // when it wires PostHog. Do NOT split into two projects/providers.
    app: "customer",
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
      // no-op here — we capture screens manually via useScreenTracking() instead
      // (route pattern, no id leakage). Touches stay off (noisy; the rage-click
      // territory we deprioritized).
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
  // Powers cross-platform keyboard handling (react-native-keyboard-controller's
  // KeyboardAwareScrollView). Must wrap any screen that uses the lib's components.
  { provider: KeyboardProvider },
  { provider: TaglyDesignBridge },
  { provider: AndroidInstagramAuthProvider },
  { provider: CurrentLocationProvider },
  { provider: UserPreferencesProvider },
  { provider: QueryClientProvider, props: { client: queryClient } },
  // SessionProvider must sit inside QueryClientProvider — it clears the query
  // cache on sign-in/out.
  { provider: SessionProvider },
  // OTP send/cooldown tracker — app-wide so any OTP flow can gate resends.
  { provider: OtpSessionProvider },
]);

/**
 * Root layout. Mounts the global providers (see `AppProviders`) and the
 * navigation stack. Theming is the new `@tagly/client` theme (always Cream for
 * now — see v2.0.0.md); the old ColorThemeProvider is gone.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...customFonts, ...Ionicons.font });
  // Preload the onboarding step artwork behind the splash (the carousel is the
  // first screen a new user sees — without this, slides flash in as each image
  // loads). `useAssets` reports errors separately; on error we proceed anyway
  // rather than holding the splash forever over a non-critical image.
  const [artwork, artworkError] = useAssets(STEP_ARTWORK);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    // Show the update gate on CLIENT_OUTDATED (426) responses.
    setOnUpdateRequired(() => setUpdateRequired(true));

    // Allow mixing with other audio (e.g. music) rather than interrupting it.
    setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
    });
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
      <AppToast />
    </AppProviders>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return (
    <StatusBar
      barStyle="dark-content"
      backgroundColor={theme.color.background}
    />
  );
}

/**
 * Boot + route guard. Runs launch-time side effects (location permission, push
 * token, pending referral), holds the splash until the session is resolved, then
 * gates `(app)` vs `(onboarding)` on JWT presence via `Stack.Protected`. With no
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
  // pending customer tapping an onboarding nudge counts too). Deliberately does
  // NOT route anywhere — push deep linking is deferred (v2.0.0.md §Notifications).
  usePushOpenedListener((data) => {
    track("push_opened", {
      slug: typeof data.slug === "string" ? data.slug : null,
    });
  });

  // No launch-time referral step: the AppsFlyer bridge captures the deep-link
  // code as a module side-effect (importing `@tagly/client` registers its
  // listeners), and attach-referrer reads it later during onboarding.
  // Permission prompts are also deliberately NOT requested at cold launch:
  //   - location → requested on the authed home, where it's actually used.
  //   - push     → requested at a primed onboarding step after OTP.
  // Prompting a logged-out user on the carousel tanks grant rates (and the iOS
  // push prompt is one-shot).

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
