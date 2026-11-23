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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  customAlert,
  customFonts,
  useTheme,
  AppToast,
  setAlertFn,
  composeProviders,
} from "@tagly/client";
import TaglyDesignBridge from "@/providers/DesignBridge";
import Ionicons from "@expo/vector-icons/Ionicons";
import { initSdk } from "@tagly/sdk/shared";
import * as Application from "expo-application";
import { useEffect } from "react";
import { SessionProvider, useSession } from "@/contexts/session/SessionContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// Initialize SDK once at app load (stamps the X-App-* headers).
initSdk({
  client: "admin",
  version: Application.nativeApplicationVersion ?? "0.0.0",
  build: Application.nativeBuildVersion ?? "1",
  platform: Platform.OS === "ios" ? "ios" : "android",
});

// Register the cross-platform alert so `@tagly/client` utils can alert.
setAlertFn(customAlert);

/** All global providers, flattened (outermost first). */
const AppProviders = composeProviders([
  {
    provider: GestureHandlerRootView,
    props: { style: StyleSheet.absoluteFillObject },
  },
  {
    provider: SafeAreaProvider,
    props: { initialMetrics: initialWindowMetrics },
  },
  // Powers cross-platform keyboard handling (the shared BottomActionBar's
  // KeyboardStickyView + KeyboardAwareScrollView forms). Must wrap any screen
  // that uses the lib's components.
  { provider: KeyboardProvider },
  { provider: TaglyDesignBridge },
  { provider: QueryClientProvider, props: { client: queryClient } },
  // SessionProvider must sit inside QueryClientProvider — it clears the query
  // cache on sign-in/out.
  { provider: SessionProvider },
]);

/**
 * Admin root layout. Mounts the global providers + the navigation stack. Theme is
 * the shared `@tagly/client` theme (always Cream). Stripped of the customer app's
 * onboarding machinery — no analytics, OAuth, location, push, or IG. No 426
 * update gate either: admin ships in lockstep via TestFlight, so builds are
 * never force-updated.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...customFonts, ...Ionicons.font });
  if (!fontsLoaded) return null;

  return (
    <AppProviders>
      <ThemedStatusBar />
      <RootNavigator />
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
 * Route guard. Holds the splash until the session is resolved, then gates `(app)`
 * vs `(auth)` on JWT presence via `Stack.Protected`. With no `app/index.tsx`, `/`
 * resolves into whichever group is unlocked.
 */
function RootNavigator() {
  const { theme } = useTheme();
  const { jwt, ready } = useSession();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    const timeout = setTimeout(() => SplashScreen.hideAsync(), 6000);
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.color.background },
      }}
    >
      <Stack.Protected guard={!!jwt}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!jwt}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
