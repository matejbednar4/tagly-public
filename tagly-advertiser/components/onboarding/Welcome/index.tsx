import { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ImageSourcePropType,
  Pressable,
  useWindowDimensions,
  ViewToken,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  CustomButton,
  pressFeedbackStyle,
  withAlpha,
  RewardInfoSheet,
  useUserPreferences,
  LanguagePicker,
  LANGUAGE_ENDONYM,
} from "@tagly/client";

/** Aspect ratio (h/w) of the step artwork files (1097×1839) — one shared frame
 *  so every slide's image lands at the exact same size and position. */
const STEP_IMAGE_RATIO = 1839 / 1097;

/**
 * Step artwork, keyed by slide. The screenshots contain UI copy, so they are
 * localized like the strings are: one folder per language under
 * `assets/how-it-works/<lang>/`. File numbering follows the slide order
 * (step-3 = the third slide), so slides still without artwork simply have no
 * entry and fall back to their icon placeholder. Assets are lossy WebP with
 * alpha (5–10× smaller than the PNG exports); convert new steps with
 * `cwebp -q 98 -alpha_q 100 -m 6 step-N.png -o step-N.webp`.
 *
 * `require` paths must be static, so each language is its own literal map
 * rather than a path built from the active locale.
 */
const CS_ARTWORK = {
  visit: require("../../../assets/how-it-works/cs/step-1.webp"),
  share: require("../../../assets/how-it-works/cs/step-2.webp"),
  reward: require("../../../assets/how-it-works/cs/step-3.webp"),
  why: require("../../../assets/how-it-works/cs/step-4.webp"),
  cta: require("../../../assets/how-it-works/cs/step-5.webp"),
} as const;

type StepKey = keyof typeof CS_ARTWORK;

/**
 * English screenshots — complete, so English users never see Czech UI in the
 * artwork. Kept `Partial` (rather than a full `Record`) deliberately: a step
 * added to `CS_ARTWORK` before its English shot exists must still compile, and
 * the missing key then falls back to the Czech frame via the spread below.
 */
const EN_ARTWORK: Partial<Record<StepKey, number>> = {
  visit: require("../../../assets/how-it-works/en/step-1.webp"),
  share: require("../../../assets/how-it-works/en/step-2.webp"),
  reward: require("../../../assets/how-it-works/en/step-3.webp"),
  why: require("../../../assets/how-it-works/en/step-4.webp"),
  cta: require("../../../assets/how-it-works/en/step-5.webp"),
};

/**
 * Every artwork asset in every language, flat — exported so the root layout can
 * preload them behind the splash screen; without that, the first swipe to a
 * step can flash a blank frame while the image loads/decodes. Typed `number[]`
 * because a bundled `require` resolves to a Metro asset module id, which is
 * what `useAssets` takes.
 */
export const STEP_ARTWORK: number[] = [
  ...Object.values(CS_ARTWORK),
  ...Object.values(EN_ARTWORK),
];

type Slide = {
  key: string;
  /** Small eyebrow label above the heading — frames the step / payoff. */
  kicker: string;
  /** Placeholder until real artwork lands — swap for `image` per slide. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Real artwork for the graphic slot; when set, replaces the icon placeholder. */
  image?: ImageSourcePropType;
  heading: string;
  body: string;
  /**
   * Renders the body as a link (underlined, ink, trailing ⓘ) that opens the
   * shared `RewardInfoSheet` in its advertiser (price) voice — the same sheet
   * the share detail's ⓘ and the drawer's "About pricing" row open, so the six
   * pricing factors are stated in exactly one place. Only the reward slide
   * sets it.
   */
  info?: boolean;
};

/**
 * Swipeable explainer carousel — the advertiser twin of the customer's, same
 * layout and chrome. Each slide is layered: the step artwork sits behind,
 * top-anchored at a fixed margin and at one shared size across all steps, and a
 * full-width text box (kicker/heading/body) in the screen background color is
 * pinned to the bottom in front of it, fading the artwork out with a gradient
 * cap as it passes underneath — so on short devices the artwork is covered more
 * instead of shrinking or colliding with the text. Slides without final artwork
 * yet show a placeholder in the same frame. Calls `onDone` when the user
 * finishes the last slide or exits early. Serves two contexts via `variant`:
 *  - `"onboarding"` (default) — the first-time entry view of
 *    `app/(onboarding)/index.tsx`; the early-exit button is "Skip" and the final
 *    button is "Get started", both advancing the entry slider to sign-in.
 *  - `"guide"` — the same carousel re-surfaced in the authed app as the "How it
 *    works" guide (`app/(app)/how-it-works`). Opened deliberately, so there's no
 *    downstream step: it drops "Skip", steps through with "Continue", and its
 *    last slide closes via a "Done" CTA (→ `onDone`) — plus the top-left back
 *    arrow exits from any slide.
 *
 * Copy lives in the colocated `onboarding` namespace and runs three mechanical
 * steps (visit → share → reward), then the payoff (why), then the ask (cta).
 */
export function Welcome({
  onDone,
  variant = "onboarding",
}: {
  onDone: () => void;
  variant?: "onboarding" | "guide";
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const { width } = useWindowDimensions();
  const { t, i18n } = useTranslation("onboarding");
  const { displayLanguage, setDisplayLanguage } = useUserPreferences();

  // The guide has no sign-in downstream: it's exited via the back arrow, not the
  // footer, so it hides "Skip" and the final "Get started" CTA (see the footer).
  const isGuide = variant === "guide";

  // The artwork is localized the same way the copy is — off the active i18n
  // language, so switching the display language re-renders both together
  // (`useTranslation` subscribes to language changes). Tags can carry a region
  // ("cs-CZ"), hence the prefix test. Any English step still missing falls back
  // to the Czech frame.
  const artwork =
    i18n.language?.startsWith("cs") === true
      ? CS_ARTWORK
      : { ...CS_ARTWORK, ...EN_ARTWORK };

  // Copy lives in the colocated `onboarding` namespace (Welcome.{en,cs}.json);
  // artwork + icons stay here. Built per render — the array is tiny.
  const slides: Slide[] = [
    {
      key: "visit",
      icon: "storefront-outline",
      image: artwork.visit,
      kicker: t("slides.visit.kicker"),
      heading: t("slides.visit.heading"),
      body: t("slides.visit.body"),
    },
    {
      key: "share",
      icon: "logo-instagram",
      image: artwork.share,
      kicker: t("slides.share.kicker"),
      heading: t("slides.share.heading"),
      body: t("slides.share.body"),
    },
    {
      key: "reward",
      icon: "cash-outline",
      image: artwork.reward,
      kicker: t("slides.reward.kicker"),
      heading: t("slides.reward.heading"),
      body: t("slides.reward.body"),
      info: true,
    },
    {
      key: "why",
      icon: "people-outline",
      image: artwork.why,
      kicker: t("slides.why.kicker"),
      heading: t("slides.why.heading"),
      body: t("slides.why.body"),
    },
    {
      key: "cta",
      icon: "wallet-outline",
      image: artwork.cta,
      kicker: t("slides.cta.kicker"),
      heading: t("slides.cta.heading"),
      body: t("slides.cta.body"),
    },
  ];

  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [areaHeight, setAreaHeight] = useState(0);
  // One sheet for the whole carousel, not one per slide.
  const [infoOpen, setInfoOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const isLast = index === slides.length - 1;

  // The primary CTA advances the carousel ("Continue"), then closes on the final
  // slide. Onboarding's final CTA is "Get started" (into sign-in); the guide has
  // nothing downstream, so its final CTA is a "Done" close. Either way it's
  // always visible — `goNext` calls `onDone` on the last slide.
  const guideDone = isGuide && isLast;

  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setIndex(first);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onAreaLayout = (e: LayoutChangeEvent) =>
    setAreaHeight(e.nativeEvent.layout.height);

  // One artwork frame shared by every slide: top-anchored at a fixed margin,
  // sized from the screen width (never the height), so all steps start at the
  // exact same spot and render at the exact same size on a given device. On
  // short screens the bottom of the artwork simply runs further under the
  // text layer's fade instead of shrinking.
  const imageWidth = width - 2 * (layout.screenPadding + spacing.sm);
  const imageHeight = imageWidth * STEP_IMAGE_RATIO;

  // The text layer's fade cap. Alpha follows a smoothstep (ease-in-out) curve
  // sampled at even stops — a plain linear ramp reads as a hard edge where the
  // fade starts and ends; easing both ends makes the artwork dissolve with no
  // visible seam. The native gradient interpolates linearly between stops, so
  // nine samples are enough to look continuous.
  const fadeColors = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return withAlpha(color.background, t * t * (3 - 2 * t));
  }) as [string, string, ...string[]];
  const fadeHeight = spacing["3xl"] + spacing.xl;

  const goNext = () => {
    if (isLast) return onDone();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: color.background,
        paddingVertical: layout.screenPadding,
      }}
    >
      {/* Measure the available height first; render slides only once we know it,
          so they never paint at height 0 (which caused a snap on mount). */}
      <View style={{ flex: 1 }} onLayout={onAreaLayout}>
        {areaHeight > 0 && (
          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(s) => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            renderItem={({ item }) => (
              // Layered slide (see the docblock): artwork behind, text box in
              // front. `overflow: "hidden"` clips artwork that runs past the
              // slide on short screens — the clip line sits behind the opaque
              // text layer, so it's never visible.
              <View style={{ width, height: areaHeight, overflow: "hidden" }}>
                {/* Layer 1 — artwork, top-anchored in the shared frame. */}
                {item.image ? (
                  <Image
                    source={item.image}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                    style={{
                      position: "absolute",
                      top: spacing.xl,
                      alignSelf: "center",
                      width: imageWidth,
                      height: imageHeight,
                    }}
                  />
                ) : (
                  // Placeholder until this slide's artwork lands — same frame
                  // as the real images so every step lines up.
                  <View
                    style={{
                      position: "absolute",
                      top: spacing.xl,
                      alignSelf: "center",
                      width: imageWidth,
                      height: imageHeight,
                      borderRadius: radius.structure,
                      backgroundColor: color.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={width * 0.22}
                      color={color.text.tertiary}
                    />
                  </View>
                )}

                {/* Layer 2 — full-width text box pinned to the bottom, in the
                    screen background color; its gradient cap fades the artwork
                    out as it passes underneath. */}
                <View
                  style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
                >
                  <LinearGradient
                    colors={fadeColors}
                    style={{ height: fadeHeight }}
                  />
                  <View
                    style={{
                      backgroundColor: color.background,
                      paddingHorizontal: layout.screenPadding,
                      gap: spacing.sm,
                      paddingTop: spacing.lg,
                      paddingBottom: spacing.xl,
                    }}
                  >
                    <Text
                      style={[
                        text.micro,
                        {
                          color: color.text.secondary,
                          textAlign: "center",
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                        },
                      ]}
                    >
                      {item.kicker}
                    </Text>
                    <Text
                      style={[
                        text.display,
                        { color: color.text.primary, textAlign: "center" },
                      ]}
                    >
                      {item.heading}
                    </Text>
                    {/* A slide flagged `info` renders its body as a link into
                        the shared pricing explainer: ink + underline (the
                        design system's link affordance) with the ⓘ centered
                        against the text on the same row. */}
                    {item.info ? (
                      <Pressable
                        onPress={() => setInfoOpen(true)}
                        accessibilityRole="button"
                        hitSlop={spacing.sm}
                        style={({
                          pressed,
                          hovered,
                        }: {
                          pressed: boolean;
                          hovered?: boolean;
                        }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: spacing.xs,
                          },
                          pressFeedbackStyle({ pressed, hovered }),
                        ]}
                      >
                        <Text
                          style={[
                            text.body,
                            {
                              color: color.ink,
                              textAlign: "center",
                              textDecorationLine: "underline",
                              flexShrink: 1,
                            },
                          ]}
                        >
                          {item.body}
                        </Text>
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color={color.ink}
                        />
                      </Pressable>
                    ) : (
                      <Text
                        style={[
                          text.body,
                          { color: color.text.secondary, textAlign: "center" },
                        ]}
                      >
                        {item.body}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        )}

        {/* Guide only: a top-left back arrow is the exit (there's no sign-in
            to skip into). Floated over the carousel — rendered after the list
            so it paints and hit-tests on top — instead of taking a flow row,
            so the slides keep the exact same layout as onboarding. `left` is
            screen padding minus the optical offset that aligns the glyph to
            the screen edge while keeping the full min-tap-target hit area. */}
        {isGuide && (
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
              {
                position: "absolute",
                top: 0,
                left: layout.screenPadding - spacing.sm,
                width: layout.minTapTarget,
                height: layout.minTapTarget,
                alignItems: "center",
                justifyContent: "center",
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={color.ink} />
          </Pressable>
        )}

        {/* Onboarding only: a language dropdown, because this is the first
            screen a new user sees and the only language control otherwise lives
            in authed settings — unreachable before sign-up, so a wrong
            first-launch detection would be unfixable here (and it now costs the
            artwork too, not just the copy). The chip shows the CURRENT language
            in its own name and opens the shared `LanguagePicker`. Floated
            top-right, mirroring the guide's back arrow on the left. */}
        {!isGuide && (
          <Pressable
            onPress={() => setLanguageOpen(true)}
            accessibilityRole="button"
            hitSlop={spacing.sm}
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
              {
                position: "absolute",
                top: 0,
                right: layout.screenPadding,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: color.surface,
                boxShadow: shadow.chip,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Ionicons
              name="language-outline"
              size={16}
              color={color.text.secondary}
            />
            <Text style={[text.label, { color: color.text.secondary }]}>
              {LANGUAGE_ENDONYM[displayLanguage]}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={color.text.tertiary}
            />
          </Pressable>
        )}
      </View>

      {/* Footer: dots (with a quiet "Skip" beside them) + the primary CTA. */}
      <View
        style={{ paddingHorizontal: layout.screenPadding, gap: spacing.lg }}
      >
        {/* Progress row. Dots stay screen-centered; onboarding gets a small
            skip-to-sign-in affordance anchored to the right — deliberately a
            quiet text pressable next to the progress, not a stacked button, so
            it reads as an aside rather than a competing action. It stays on
            the last slide too (same destination as "Get started"), so it never
            pops out of the layout. The guide has no skip — its back arrow is
            the exit. The row keeps min-tap-target height so the absolutely
            positioned skip's full hit area stays inside the pressable bounds. */}
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            minHeight: layout.minTapTarget,
          }}
        >
          <Dots count={slides.length} active={index} />
          {!isGuide && (
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              hitSlop={spacing.sm}
              style={({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => [
                {
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                  // Optically align the label to the screen-padding edge while
                  // keeping a full-size hit area (mirrors the guide back arrow).
                  paddingLeft: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("skip")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={color.text.secondary}
              />
            </Pressable>
          )}
        </View>
        {/* Primary CTA — always visible, including the guide's last slide,
            which becomes a "Done" close (leading checkmark) instead of
            vanishing. */}
        <CustomButton
          type="primary"
          label={
            isLast ? (isGuide ? t("done") : t("getStarted")) : t("continue")
          }
          onPress={goNext}
          icon={guideDone ? "checkmark" : "arrow-forward"}
          iconPosition={guideDone ? "leading" : "trailing"}
        />
      </View>

      {/* The pricing explainer, in the advertiser (price) voice — the same sheet
          the share detail and the drawer open, so the six factors are written
          once. Presentational, so it works here before sign-in too. */}
      <RewardInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        variant="advertiser"
      />

      {/* Display-language dropdown (see the chip above). The pick is device
          local and applies instantly — copy and artwork re-render together. */}
      <LanguagePicker
        open={languageOpen}
        current={displayLanguage}
        onPick={(lang) => {
          setDisplayLanguage(lang);
          setLanguageOpen(false);
        }}
        onClose={() => setLanguageOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Pagination dots; the active one stretches into a pill. */
function Dots({ count, active }: { count: number; active: number }) {
  const { theme } = useTheme();
  const { color, spacing, radius } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xs,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: spacing.sm,
            width: i === active ? spacing.xl : spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: i === active ? color.ink : color.text.tertiary,
          }}
        />
      ))}
    </View>
  );
}
