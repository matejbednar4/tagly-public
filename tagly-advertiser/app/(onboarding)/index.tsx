import { useEffect, useRef, useState } from "react";
import { Animated, Platform, View, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";
import { Welcome } from "@/components/onboarding/Welcome";
import { SignIn } from "@/components/onboarding/SignIn";

/** Vertical slider views, in order. */
const VIEWS = ["onboarding", "signin"] as const;
type SlideView = (typeof VIEWS)[number];

/**
 * Onboarding entry — the `/` route of the group. Two cohesive views (carousel +
 * sign-in) in one vertical slider: "Get started" slides up to sign-in; the info
 * button slides back. The linear registration steps (otp → notifications →
 * consent → finishing) are separate stack routes.
 *
 * On launch, a stored `registrationToken` (mid-registration, validated against
 * `check-registration` in the provider) short-circuits the entry and redirects
 * straight to the resumed step.
 */
export default function OnboardingEntry() {
  const {
    hydrated,
    seenOnboarding,
    registrationToken,
    resolveNextRoute,
    markOnboardingSeen,
  } = useOnboarding();

  const [view, setView] = useState<SlideView | null>(null);
  // Page height: iOS keeps the window height (proven to work). Android uses the
  // MEASURED container height instead — with edge-to-edge, the reported window
  // height can exclude the system navigation bar, which made page 1 end short
  // and exposed page 2's top as a fat blank band under the CTA (same fix as the
  // customer app's entry).
  const { height: windowHeight } = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const pageHeight = Platform.OS === "android" ? measuredHeight : windowHeight;
  const translateY = useRef(new Animated.Value(0)).current;
  const decided = useRef(false);

  // Decide the starting view once hydrated (carousel first-time, else sign-in).
  useEffect(() => {
    if (!hydrated || view !== null) return;
    setView(seenOnboarding ? "signin" : "onboarding");
  }, [hydrated, seenOnboarding, view]);

  // Slide when the active view changes (the first decision jumps without animating).
  useEffect(() => {
    if (view === null || pageHeight === 0) return;
    const target = -VIEWS.indexOf(view) * pageHeight;
    if (!decided.current) {
      translateY.setValue(target);
      decided.current = true;
      return;
    }
    Animated.timing(translateY, {
      toValue: target,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [view, pageHeight, translateY]);

  // Resume: a stored registration token means mid-registration — skip the entry.
  if (hydrated && registrationToken) {
    return <Redirect href={resolveNextRoute()} />;
  }

  // Still hydrating — splash is held at the root until session is ready.
  if (view === null) return null;

  return (
    <View
      style={{ flex: 1, overflow: "hidden" }}
      onLayout={(e) => setMeasuredHeight(e.nativeEvent.layout.height)}
    >
      {pageHeight > 0 && (
        <Animated.View
          style={{
            height: pageHeight * VIEWS.length,
            transform: [{ translateY }],
          }}
        >
          <View style={{ height: pageHeight }}>
            <Welcome
              onDone={() => {
                markOnboardingSeen();
                setView("signin");
              }}
            />
          </View>
          <View style={{ height: pageHeight }}>
            <SignIn
              active={view === "signin"}
              onShowOnboarding={() => setView("onboarding")}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}
