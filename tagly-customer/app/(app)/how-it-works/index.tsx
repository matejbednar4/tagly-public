import { View } from "react-native";
import { useRouter } from "expo-router";
import { Welcome } from "@/components/onboarding/Welcome";

/**
 * "How it works" — the authed in-app guide, reached from the drawer. It re-surfaces
 * the first-run explainer carousel ({@link Welcome}) in its `"guide"` variant, so
 * users who skipped or forgot the onboarding intro can revisit "find → post → earn
 * → why" any time. `onDone` simply pops back to wherever they opened it from (the
 * guide's "Done" button; swipe-back works too, via the default stack gesture).
 *
 * One canonical carousel, two entry points — the onboarding entry and this guide
 * share the same component and copy; only the flow-specific footer labels differ.
 */
export default function HowItWorksScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Welcome variant="guide" onDone={() => router.back()} />
    </View>
  );
}
