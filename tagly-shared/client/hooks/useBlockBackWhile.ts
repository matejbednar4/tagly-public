import { useEffect } from "react";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";

/**
 * Block EVERY way of leaving the current screen while `blocked` is true — used
 * by the init+confirm submit flows (business create, media edit — advertiser
 * AND admin), where navigating away mid-submit would abandon a half-done
 * two-phase write (the server may still be validating/promoting after the
 * client leaves).
 *
 * Covers all three back paths:
 *  - iOS edge-swipe: `gestureEnabled` is flipped off (a native-stack gesture
 *    completes natively, so it must be disabled up front — `beforeRemove`
 *    alone can't reliably cancel it),
 *  - Android hardware back + programmatic `goBack`: `usePreventRemove`
 *    swallows the `beforeRemove` event (silently — the submit overlay already
 *    tells the user what's running),
 *  - the header back button: hosts hide/cover their TopMenu themselves (the
 *    bar is app chrome, not navigator chrome).
 *
 * ⚠️ **Never flip `blocked` false and navigate in the same tick.**
 * `usePreventRemove`'s `beforeRemove` listener reads `preventRemove` from the
 * latest COMMITTED render, so a `setState(false)` immediately followed by
 * `router.back()`/`replace()` still sees `true` and silently `preventDefault()`s
 * the navigation — the screen just stays put, usually with a success toast
 * already shown and its submit button live again (that combination is how the
 * business-create wizard produced duplicate pages). Defer the navigation by a
 * tick (`setTimeout(..., 0)`) so the release commits first. See the handoff at
 * the end of `CreateBusinessWizard`'s `submit`, and both media-edit screens.
 */
export function useBlockBackWhile(blocked: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !blocked });
  }, [navigation, blocked]);

  usePreventRemove(blocked, () => {
    // Swallow silently — a submit is in flight and the overlay explains it.
  });
}
