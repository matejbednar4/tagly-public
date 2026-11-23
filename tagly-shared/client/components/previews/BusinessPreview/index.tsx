import { StyleProp, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BusinessPublicPreview } from "@tagly/models/v2/customerApp";
import { CustomMedia } from "../../media/CustomMedia";
import {
  CustomButton,
  CUSTOM_BUTTON_HEIGHT,
} from "../../primitives/CustomButton";
import { useTheme } from "../../../theme/ThemeProvider";
import { withAlpha } from "../../../theme/colorUtils";
import { useFormatBudget } from "../../../hooks/useFormatBudget";
import { useCatalogLocalizer } from "../../../i18n/useCatalogLocalizer";
import { useUserPreferences } from "../../../contexts/UserPreferencesContext";
import { calculateDistance } from "../../../utils/geo/calculateDistance";
import { spacing } from "../../../theme/theme";
import { RewardCalculatingIndicator } from "../../feedback/RewardCalculatingIndicator";

/**
 * BusinessPreview — the canonical business card used across the app (map
 * carousel, search/discover results, etc.).
 *
 * A 16:9 photo with a solid white info bar docked at the bottom: the name sits
 * on the white surface in the Playfair heading face (legible, unlike text over
 * a photo), with the reward + reach (success-green) on the right. An accent
 * "type" badge (with icon + shadow) floats on the photo, top-left.
 *
 * Reward + reach come from the v2 reward projection (`estimatedRewardCents` /
 * `estimatedAverageReach`), which are null until the estimate backend lands —
 * the pill then simply doesn't render. Money is formatted via `useFormatBudget`
 * ("cca X Kč" for CZ viewers, "est. $X" otherwise); the type via the catalog
 * localizer.
 *
 * Platform-funded businesses (`isSubsidizedByPlatform`) show a small white
 * "Subsidized by Tagly" line on the photo, just above the info bar. A
 * budget-capped reward (`isRewardCapped`) renders as "up to {amount}" (the
 * affordable payout is an upper bound on a shared budget), and a low-budget
 * business (`isLowBudget`) gets a danger-tinted "Ending soon" scarcity pill top-left
 * (the business may run out of budget and disappear, so share it while it lasts).
 *
 * Owns its own navigation: tapping the card always opens the business detail
 * (`/businesses/:uid`), and the "Earn here" CTA routes into the share-create flow
 * — callers don't pass press handlers. `disablePress` opts out entirely (an
 * inert, purely informational card).
 *
 * Opt-in:
 *   • `showEarnButton` — renders the primary "Earn here" CTA below the card
 *     (disabled while another card is selected, `selected === false`). Reserve
 *     the extra space with `businessPreviewHeight(width, { withButton: true })`.
 *   • `dimmed` — recedes the card behind a scrim (e.g. unselected carousel
 *     items).
 *   • `currentLocation` — when set, shows a distance badge ("4.5 km") top-right,
 *     in the viewer's `distanceUnit` (KM/MI).
 *
 * `selected` elevates the card (card → float shadow). All tokens come from the
 * active theme; no hardcoded hex / size / radius, no borders (shadow separates).
 */

export interface BusinessPreviewProps {
  business: BusinessPublicPreview;
  /** Card width in px. Height is derived from it. */
  width: number;
  selected?: boolean;
  /** When true, renders the "Earn here" CTA below the card. */
  showEarnButton?: boolean;
  /**
   * Override the CTA label (default "Earn here"). E.g. the share-detail screen
   * passes "Share again", since the viewer has already shared this business.
   */
  earnButtonLabel?: string;
  /** Recede the card behind a scrim (e.g. unselected carousel items). */
  dimmed?: boolean;
  /** Viewer location — when set, shows a "N km" distance badge, top-right. */
  currentLocation?: { lat: number; lon: number } | null;
  style?: StyleProp<ViewStyle>;
  titleBackgroundColor?: string;
  /**
   * Override the default card tap (which navigates to the business detail) — e.g.
   * the map carousel selects an unselected card on first tap and only opens the
   * detail on the second. When omitted, tapping navigates to the detail.
   */
  onPress?: () => void;
  /**
   * Make the card inert — no navigation and no press feedback. For surfaces
   * where the card is purely informational (e.g. the share-opportunity sheet,
   * which must not navigate away from its own decision).
   */
  disablePress?: boolean;
}

/**
 * Total rendered height for a given width: the 16:9 card, plus the "Earn here"
 * CTA (its height + the gap above it) when `withButton` is set.
 */
export const businessPreviewHeight = (
  width: number,
  opts?: { withButton?: boolean },
) =>
  Math.round(width * (9 / 16)) +
  (opts?.withButton ? CUSTOM_BUTTON_HEIGHT + spacing.sm : 0);

/** Shared derived copy. */
function usePreviewCopy(business: BusinessPublicPreview) {
  const { t } = useTranslation("businessPreview");
  const formatBudget = useFormatBudget();
  const { typeName } = useCatalogLocalizer();

  const hasReward = typeof business.estimatedRewardCents === "number";
  const estText = hasReward
    ? t(
        // Budget-capped reward → "up to {amount}", since the affordable payout is
        // an upper bound (a shared budget can be drained before settle). Uncapped
        // → the plain "est. {amount}".
        business.isRewardCapped ? "previewEstRewardCapped" : "previewEstReward",
        {
          amount: formatBudget(business.estimatedRewardCents!, {
            singleCentDigit: true,
          }),
        },
      )
    : null;
  const reachText =
    hasReward && business.estimatedAverageReach !== null
      ? t("previewReach", {
          reach: business.estimatedAverageReach.toLocaleString(),
        })
      : null;

  // Connected but the audience snapshot isn't taken yet → reward is null with the
  // NO_SNAPSHOT slug. Show the calculating affordance instead of an empty slot.
  const isCalculating =
    !hasReward && business.rewardMessageSlugs.includes("NO_SNAPSHOT");

  return {
    typeLabel: typeName(business.type.slug),
    estText,
    reachText,
    isCalculating,
    earnLabel: t("earnHereButton"),
    subsidizedText: business.isSubsidizedByPlatform
      ? t("subsidizedByPlatform")
      : null,
    // Scarcity flag — the business is running low on budget and may disappear
    // soon. Never set for subsidized/PAYG (server guarantees).
    endingSoonLabel: business.isLowBudget ? t("endingSoon") : null,
  };
}

export function BusinessPreview({
  business,
  width,
  selected,
  showEarnButton,
  earnButtonLabel,
  dimmed,
  currentLocation,
  style,
  titleBackgroundColor,
  onPress,
  disablePress,
}: BusinessPreviewProps) {
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  const router = useRouter();

  // Casts below: customer-app routes; this shared component is also
  // typechecked against the advertiser app's typed routes, which don't
  // include them (the preview never mounts there).
  // Default tap → business detail; callers (e.g. the map carousel) can override.
  const openDetail = () =>
    router.push({
      pathname: "/businesses/[uid]",
      params: { uid: business.uid },
    } as unknown as Href);
  const handlePress = onPress ?? openDetail;
  // The "Earn here" CTA routes into the share-create flow (story picker),
  // carrying the target business so the created share is attributed to it.
  const onEarn = () =>
    router.push({
      pathname: "/shares/create",
      params: { businessUid: business.uid, businessName: business.name },
    } as unknown as Href);
  const { distanceUnit } = useUserPreferences();
  const {
    typeLabel,
    estText,
    reachText,
    isCalculating,
    earnLabel,
    subsidizedText,
    endingSoonLabel,
  } = usePreviewCopy(business);

  const distanceText =
    currentLocation && business.address.location
      ? calculateDistance(
          business.address.location,
          currentLocation.lat,
          currentLocation.lon,
          distanceUnit,
        )
      : null;

  return (
    <View style={[{ width }, style]}>
      {/* Plain View container (shape + elevation only). The tap is owned by the
          single CustomMedia touchable below — nesting a Pressable here too made
          two touch responders fight inside the carousel FlatList and dropped the
          press. */}
      <View
        style={{
          height: Math.round(width * (9 / 16)),
          borderRadius: radius.structure,
          overflow: "hidden",
          boxShadow: selected ? shadow.float : shadow.button,
        }}
      >
        <CustomMedia
          media={business.banner}
          disableFullscreenPreview
          disablePress={disablePress}
          style={{ flex: 1 }}
          onPress={handlePress}
          backgroundColor={color.surface}
        >
          {/* Top-left badge stack: the type badge, plus an "Ending soon"
              scarcity pill below it when the business is running low on
              budget and may disappear. */}
          <View
            style={{
              position: "absolute",
              top: spacing.sm,
              left: spacing.sm,
              alignItems: "flex-start",
              gap: spacing.xs,
            }}
          >
            {/* Type badge — accent fill, shadow, storefront icon. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: 3,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: color.accent,
                boxShadow: shadow.chip,
              }}
            >
              <Ionicons
                name="storefront-outline"
                size={12}
                color={color.on.accent}
              />
              <Text
                style={[text.micro, { color: color.on.accent }]}
                numberOfLines={1}
              >
                {typeLabel}
              </Text>
            </View>

            {/* Ending-soon pill — danger-tinted fill, hourglass icon. Signals
                scarcity (low budget, may disappear soon) — the one deliberate
                non-error use of the danger family (see the design-system color
                rules). */}
            {endingSoonLabel && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingVertical: 3,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: color.dangerBg,
                  boxShadow: shadow.chip,
                }}
              >
                <Ionicons
                  name="hourglass-outline"
                  size={12}
                  color={color.on.dangerBg}
                />
                <Text
                  style={[text.micro, { color: color.on.dangerBg }]}
                  numberOfLines={1}
                >
                  {endingSoonLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Distance badge on the photo, top-right (when the viewer's location
              is known) — translucent ink chip so it reads over any photo. */}
          {distanceText && (
            <View
              style={{
                position: "absolute",
                top: spacing.sm,
                right: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: 3,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: color.brand,
                boxShadow: shadow.chip,
              }}
            >
              <Ionicons
                name="navigate-outline"
                size={11}
                color={color.on.brand}
              />
              <Text
                style={[text.micro, { color: color.on.brand }]}
                numberOfLines={1}
              >
                {distanceText}
              </Text>
            </View>
          )}

          {/* Bottom stack: an optional "subsidized by Tagly" line sitting on the
              photo, directly above the white info bar. */}
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
            {subsidizedText && (
              <Text
                style={[
                  text.micro,
                  {
                    color: "#FFFFFF",
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.xs,
                    // Subtle shadow so the white text stays legible over any photo.
                    textShadowColor: "rgba(0, 0, 0, 0.45)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  },
                ]}
                numberOfLines={1}
              >
                {subsidizedText}
              </Text>
            )}

            {/* Info bar — name (ink, readable) + reward & reach. Slightly
                translucent so it settles onto the photo instead of a hard block. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
                padding: spacing.md,
                backgroundColor: withAlpha(
                  titleBackgroundColor || color.surface,
                  0.95,
                ),
              }}
            >
              <Text
                style={[
                  text.title,
                  {
                    color: color.text.primary,
                    flexShrink: 1,
                  },
                ]}
                numberOfLines={2}
              >
                {business.name}
              </Text>
              {estText ? (
                <View style={{ alignItems: "flex-end" }}>
                  {/* Reward = money → success green, in sans. */}
                  <Text
                    style={[
                      text.amountSm,
                      { color: color.success, lineHeight: 18 },
                    ]}
                    numberOfLines={1}
                  >
                    {estText}
                  </Text>
                  {reachText && (
                    <Text
                      style={[text.micro, { color: color.text.tertiary }]}
                      numberOfLines={1}
                    >
                      {reachText}
                    </Text>
                  )}
                </View>
              ) : isCalculating ? (
                <RewardCalculatingIndicator iconSize={15} />
              ) : null}
            </View>
          </View>

          {/* Scrim to recede the card when unselected. */}
          {dimmed && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: withAlpha(color.text.tertiary, 0.56),
              }}
            />
          )}
        </CustomMedia>
      </View>

      {/* Toggleable primary CTA, below the card. Hidden outright when the
          business fails the accessibility rule (out of budget/allowance) —
          a share created now would only be rejected at createShare (4003). */}
      {showEarnButton && business.isAccessible && (
        <CustomButton
          type="primary"
          label={earnButtonLabel ?? earnLabel}
          onPress={onEarn}
          icon="sparkles"
          disabled={selected === false}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </View>
  );
}
