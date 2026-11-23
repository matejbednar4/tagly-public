import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Easing,
  LayoutChangeEvent,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";

// Duration of the height tween when the sheet's content changes size while the
// sheet is open (e.g. a loading spinner swapping to the loaded view).
const RESIZE_DURATION = 240;

// Force-unmount deadline for a close. The exit animations run 180/200ms; if the
// completion callback hasn't unmounted the Modal by this long after the close
// started, the watchdog does it regardless. Native-driver completion callbacks
// hosted inside a Modal are known to get dropped (interrupted animations also
// report finished=false and previously did nothing) — and a still-mounted
// invisible Modal swallows every touch on the screen behind it. Worst case with
// the watchdog is an exit animation clipped ~200ms early; without it, a dead UI.
const EXIT_WATCHDOG_MS = 400;

type BottomSheetProps = {
  open: boolean;
  /**
   * Close handler. When omitted the sheet is **non-dismissable** — the backdrop,
   * the Android back button, and the pull-down-to-dismiss gesture won't close it
   * (e.g. a required choice).
   */
  onClose?: () => void;
  children: ReactNode;
  /**
   * Fired the moment the sheet's `Modal` actually **unmounts** — after the exit
   * animation, or after the watchdog force-unmounts it. Use it to chain sheets:
   * two `Modal`s must never be mounted at once (the outgoing one keeps
   * swallowing touches while it dismisses), so a host that opens sheet B from
   * sheet A closes A first and opens B from here. See `useSheetRouter` in the
   * advertiser app.
   */
  onClosed?: () => void;
  /**
   * Opt OUT of the built-in scroll: the child **owns its own scrolling** (a
   * `FlatList` / `SectionList`), which RN forbids nesting inside a `ScrollView`.
   * The grabber stays pinned above the child, the child flex-fills the capped
   * height, and its content sits flush to the sheet's bottom edge (the child
   * manages its own bottom inset). Use this ONLY for a virtualized-list sheet
   * (e.g. `CustomPicker`); every other sheet leaves it off and scrolls normally.
   */
  ownsScroll?: boolean;
};

// How far the content must be pulled past its top (negative overscroll) before
// releasing the drag dismisses the sheet — mirrors origin/main's BottomOverlay.
const DISMISS_OVERSCROLL = -80;

/**
 * Bottom sheet on the new theme. The **backdrop fades** while the **panel
 * slides** up/down independently (RN's `animationType="slide"` would slide the
 * dim in too). Pass `onClose` to make it dismissable; omit it for a forced
 * choice. Stays mounted through the exit animation, then unmounts — driven by
 * the close *intent*, never solely by animation completion: a watchdog
 * (`EXIT_WATCHDOG_MS`) force-unmounts if the exit's completion callback is
 * dropped or interrupted, since a lingering invisible Modal would otherwise
 * swallow every touch on the screen behind it.
 *
 * **Always scrollable.** Children are rendered inside a single `ScrollView`
 * (capped at `maxContentHeight`), so any sheet scrolls when its content is tall
 * and short sheets just size to content. The grabber is the first item **inside**
 * the scroll, so it scrolls away with the content. Pulling the content down past
 * its top and releasing dismisses the sheet (`DISMISS_OVERSCROLL`; iOS bounce —
 * Android relies on the backdrop / back button). The consistent bottom breathing
 * room (`insets.bottom + screenPadding`) lives in the scroll content, not as a
 * panel margin, so it scrolls with everything else. Do **not** put a `FlatList`
 * or another `ScrollView` inside — pass its items as plain children instead.
 *
 * **Auto-resizing.** The panel's height is driven explicitly from the scroll
 * content's measured natural height (`onContentSizeChange`), not left to
 * auto-layout. When the children change size while the sheet is open (loading
 * spinner → loaded view, an expanding form), the panel tweens smoothly to the
 * new height, still capped at `maxContentHeight` (above which it scrolls). The
 * `ownsScroll` branch keeps plain flex-fill sizing — a virtualized list has no
 * natural height to measure.
 *
 * **Keyboard:** opening the sheet dismisses any keyboard that was already up
 * (e.g. the field behind it). If the sheet itself contains an input, the panel
 * lifts above the keyboard — the scroll area's bottom padding grows by the
 * keyboard height (animated in sync with the system show/hide), so the content
 * rides up and stays visible. Tapping empty scroll area dismisses the keyboard
 * (`keyboardShouldPersistTaps="handled"`), while buttons/inputs still get taps.
 */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  children,
  ownsScroll = false,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const { color, radius, layout, spacing } = theme;
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  // Cap the panel so it can never exceed the screen (e.g. tall content + the
  // keyboard padding below). Content taller than this scrolls; short sheets stay
  // well under it, so they're unaffected.
  const maxContentHeight = screenH - insets.top - spacing.lg;

  const [mounted, setMounted] = useState(open);
  const backdrop = useRef(new Animated.Value(0)).current; // 0..1
  const translateY = useRef(new Animated.Value(1000)).current; // px below rest
  const keyboardPad = useRef(new Animated.Value(0)).current; // extra bottom pad
  const heightRef = useRef(0);
  const enteredRef = useRef(false);

  // Latest open intent + the close watchdog. Unmounting must track the *intent*
  // (open=false), never the animation system — see EXIT_WATCHDOG_MS.
  const openRef = useRef(open);
  openRef.current = open;
  const closeWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref so the close effect below doesn't re-run (and restart the
  // exit) just because the host passed a new callback identity.
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  /** Unmount + tell the host, from either the animation or the watchdog. */
  const finishClose = () => {
    setMounted(false);
    onClosedRef.current?.();
  };

  // Natural (unclamped) height of the scroll content. The panel's height is
  // driven from this value instead of letting layout auto-size around the
  // ScrollView: animating the layout change after the fact (transform offsets
  // measured in onLayout, LayoutAnimation.configureNext) proved unreliable
  // inside a Modal whose ancestor already carries a native-driver transform —
  // either a visible snap-then-correct, or the commit's height change being
  // dropped entirely. An explicit animated height makes the tween the single
  // source of truth and keeps it fully isolated from the open/close slide.
  const contentH = useRef(new Animated.Value(0)).current;
  const contentHRef = useRef(0);

  // The ScrollView's content container reports its natural size here whenever
  // the children change. First measure (and any change while not settled open)
  // applies instantly — the entry slide needs the final height up front, and a
  // resize must never fight the exit. Changes while open and entered tween.
  const onContentSize = (_w: number, h: number) => {
    if (Math.abs(h - contentHRef.current) < 0.5) return;
    contentHRef.current = h;
    if (open && enteredRef.current) {
      Animated.timing(contentH, {
        toValue: h,
        duration: RESIZE_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false, // height is a layout prop
      }).start();
    } else {
      contentH.setValue(h);
    }
  };

  // The backdrop fade is owned entirely here — tied to open/close, never to
  // layout — so it always plays regardless of when the panel measures.
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      // Reopened while the exit was still running (still mounted, entry flag
      // already cleared, height already measured): the panel is mid-slide-down
      // and — with an unchanged height — no fresh onLayout fires to replay the
      // slide, so re-enter it from wherever it is. A fresh open (height not yet
      // measured, `heightRef` still 0) instead slides in from onLayout once the
      // height is known, so the slide distance is exact.
      if (mounted && !enteredRef.current && heightRef.current > 0) {
        enteredRef.current = true;
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    } else if (mounted) {
      enteredRef.current = false;
      // Watchdog: if the completion callback below gets dropped (or reports
      // finished=false with no reopen), force the unmount anyway — a lingering
      // invisible Modal blocks all touches behind it. Cleared by this effect's
      // cleanup on reopen/unmount, and below when the callback does its job.
      closeWatchdog.current = setTimeout(() => {
        closeWatchdog.current = null;
        if (!openRef.current) {
          console.warn(
            "[BottomSheet] exit animation never completed — force-unmounting",
          );
          finishClose();
        }
      }, EXIT_WATCHDOG_MS);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: heightRef.current || 1000,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Unmount on intent, not on `finished`: an interrupted exit (finished
        // false) with the sheet still meant to be closed must still unmount.
        // A reopen mid-exit lands here too (its re-entry interrupts these
        // animations) — openRef is true then, so the sheet stays mounted.
        if (closeWatchdog.current) {
          clearTimeout(closeWatchdog.current);
          closeWatchdog.current = null;
        }
        if (!openRef.current) finishClose();
      });
    }
    return () => {
      if (closeWatchdog.current) {
        clearTimeout(closeWatchdog.current);
        closeWatchdog.current = null;
      }
    };
  }, [open, mounted, backdrop, translateY]);

  // Keyboard handling: dismiss whatever was open behind the sheet on open, then
  // track the keyboard so a sheet with its own input can lift above it. The pad
  // animates with the system show/hide (iOS gives us the real duration).
  useEffect(() => {
    if (!open) return;
    Keyboard.dismiss();

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const animatePad = (kb: number, duration: number) =>
      Animated.timing(keyboardPad, {
        toValue: kb,
        duration: duration || 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

    const showSub = Keyboard.addListener(showEvt, (e) =>
      animatePad(e.endCoordinates.height, e.duration),
    );
    const hideSub = Keyboard.addListener(hideEvt, (e) =>
      animatePad(0, e.duration),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
      keyboardPad.setValue(0);
    };
  }, [open, keyboardPad]);

  // Slide the panel up from below once the panel has a real height. On a fresh
  // mount the first frame lays out at height 0 (the content hasn't reported its
  // size yet), so wait for a non-zero layout — the slide distance is then exact.
  // Later content-driven height changes re-fire this with `enteredRef` already
  // set, which just keeps `heightRef` current for the exit slide distance.
  const onSheetLayout = (e: LayoutChangeEvent) => {
    heightRef.current = e.nativeEvent.layout.height;
    if (open && !enteredRef.current && heightRef.current > 0) {
      enteredRef.current = true;
      translateY.setValue(heightRef.current);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  // Releasing a downward overscroll past the top dismisses (iOS bounce gives the
  // negative offset; Android has no bounce, so it relies on the backdrop / back
  // button, same as origin/main).
  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onClose) return;
    const y = e.nativeEvent.contentOffset.y;
    const vy = e.nativeEvent.velocity?.y ?? 0;
    if (y < DISMISS_OVERSCROLL && vy <= 0) onClose();
  };

  const grabber = (
    <View
      style={{
        alignSelf: "center",
        width: 36,
        height: 4,
        borderRadius: radius.pill,
        backgroundColor: color.border.strong,
      }}
    />
  );

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "black",
              opacity: backdrop.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
              }),
            },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Outer view owns the native-driven slide (transform); the inner view
            owns the JS-driven layout props (height + keyboard padding). They
            must be separate views — the native animated module rejects a layout
            prop like paddingBottom on a view it's already driving natively. */}
        <Animated.View
          onLayout={onSheetLayout}
          style={{
            transform: [{ translateY }],
            backgroundColor: color.background,
            borderTopLeftRadius: radius.structure * 2,
            borderTopRightRadius: radius.structure * 2,
            boxShadow: theme.shadow.float,
          }}
        >
          {ownsScroll ? (
            // The child owns its scrolling (a FlatList). Grabber pinned above it;
            // the child flex-fills the capped height and reaches the bottom edge.
            // No natural content height to measure here, so sizing stays plain
            // auto-layout (no resize tween).
            <Animated.View
              style={{
                maxHeight: maxContentHeight,
                paddingHorizontal: layout.screenPadding,
                paddingTop: layout.screenPadding,
                gap: spacing.lg,
                paddingBottom: keyboardPad,
              }}
            >
              {grabber}
              {children}
            </Animated.View>
          ) : (
            <Animated.View
              style={{
                // min(natural content height + keyboard lift, screen cap): tall
                // content is capped and scrolls inside; the keyboard pad below
                // keeps the scroll area above the keyboard.
                height: Animated.add(contentH, keyboardPad).interpolate({
                  inputRange: [0, maxContentHeight],
                  outputRange: [0, maxContentHeight],
                  extrapolate: "clamp",
                }),
                paddingBottom: keyboardPad,
              }}
            >
              <ScrollView
                style={{ flexShrink: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollEndDrag={handleScrollEndDrag}
                onContentSizeChange={onContentSize}
                contentContainerStyle={{
                  gap: spacing.lg,
                  paddingHorizontal: layout.screenPadding,
                  paddingTop: layout.screenPadding,
                  // Consistent bottom breathing room, kept INSIDE the scroll so it
                  // scrolls with the content (not a fixed panel margin).
                  paddingBottom: insets.bottom + layout.screenPadding,
                }}
              >
                {/* Grabber scrolls with the content (first item in the scroll). */}
                {grabber}
                {children}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
