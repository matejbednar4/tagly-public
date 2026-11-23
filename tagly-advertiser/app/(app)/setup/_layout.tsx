import { Stack } from "expo-router";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";

/**
 * Post-sign-in setup phase — the skippable payment step, then the
 * business-page step. Visually a continuation of onboarding: same theme,
 * forward-only (gestures disabled), reached via the `(app)` gate while a step
 * is pending (its server-derived fact unsatisfied + not dismissed on this
 * device — see `AdvertiserContext`). Resolving the payment step advances the
 * guard here to the business-page step; resolving that flips the outer gate to
 * `(tabs)`.
 */
export default function SetupLayout() {
  const { paymentSetupPending } = useAdvertiser();

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Protected guard={paymentSetupPending}>
        <Stack.Screen name="payment/index" />
      </Stack.Protected>
      <Stack.Protected guard={!paymentSetupPending}>
        <Stack.Screen name="business-page/index" />
      </Stack.Protected>
    </Stack>
  );
}
