import { View } from "react-native";
import { useRouter } from "expo-router";
import { Welcome } from "@/components/onboarding/Welcome";

/**
 * "How it works" — the authed in-app guide, reached from the drawer. It
 * re-surfaces the first-run explainer carousel ({@link Welcome}) in its
 * `"guide"` variant, so advertisers who skipped or forgot the onboarding intro
 * can revisit "load → customers → pay → why" any time. `onDone` pops back to
 * wherever they opened it from (the last slide's "Done" CTA or the guide's back
 * arrow; swipe-back works too).
 *
 * One canonical carousel, two entry points — the onboarding entry and this
 * guide share the same component and copy; only the flow-specific footer chrome
 * differs (mirrors tagly-customer's how-it-works).
 */
export default function HowItWorksScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Welcome variant="guide" onDone={() => router.back()} />
    </View>
  );
}
