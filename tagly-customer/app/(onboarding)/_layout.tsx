import { Stack } from "expo-router";
import { OnboardingProvider } from "@/contexts/onboarding/OnboardingContext";

/**
 * Onboarding route group. Mounts the {@link OnboardingProvider} (registration
 * state + auth actions, shared across every step) above a native Stack. The
 * entry (`index`) is the welcome+sign-in slider; the linear steps (otp, consent,
 * profile, instagram) are pushed onto the stack.
 *
 * The post-identity steps (notifications, consent, profile, instagram) are
 * **forward-only**: they're reached via `router.replace`, so a back-swipe would
 * pop to the entry and immediately redirect forward again (a no-op flicker).
 * Gestures are disabled stack-wide via `screenOptions` (so any future step is
 * **forward-only** by default) and re-enabled **only** on `otp` (where swiping
 * back to the sign-in entry to fix a mistyped email is intended). Every screen is
 * declared explicitly for clarity.
 *
 * Note: folder routes with an `index.tsx` are named `<folder>/index` here (e.g.
 * `otp/index`), not `<folder>` — the name must match exactly or the override is
 * ignored (and expo-router warns).
 */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="otp/index" options={{ gestureEnabled: true }} />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen name="consent/index" />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="instagram/index" />
      </Stack>
    </OnboardingProvider>
  );
}
