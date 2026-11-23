import { Stack } from "expo-router";
import { OnboardingProvider } from "@/contexts/onboarding/OnboardingContext";

/**
 * Onboarding route group. Mounts the {@link OnboardingProvider} (entry state +
 * auth actions, shared across every step) above a native Stack. The entry
 * (`index`) is the welcome+sign-in slider.
 *
 * The linear flow is: identity (`index` → `otp` for the email path, or Google/
 * Apple straight from `index`) → `notifications` → `consent` → `finishing`
 * (auto-promotes the account). Post-identity steps are **forward-only** (reached
 * via `router.replace`); gestures are disabled stack-wide and re-enabled **only**
 * on `otp` (to swipe back and fix a mistyped email). Folder routes with an
 * `index.tsx` are named `<folder>/index` (the name must match exactly or the
 * override is ignored).
 */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="otp/index" options={{ gestureEnabled: true }} />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen name="consent/index" />
        <Stack.Screen name="finishing/index" />
      </Stack>
    </OnboardingProvider>
  );
}
