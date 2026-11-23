import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BusinessPublicPreview } from "@tagly/models/v2/customerApp";
import { useTheme } from "../../theme/ThemeProvider";
import { useFormatBudget } from "../../hooks/useFormatBudget";
import { spacing } from "../../theme/theme";

/**
 * Map marker rendered as a child of <Marker>.
 *
 * Layout is just the pill + a small pointer tip beneath it — NO transparent
 * spacer. The pointer tip is placed on the coordinate by the parent <Marker>'s
 * `centerOffset` (set from the height we report via `onHeight`), not by padding
 * the view to twice its size. That matters for touch: the marker's tappable
 * bounds now equal the *visible* card, so pressing the empty space below it no
 * longer selects it. (The old spacer trick made the view 2× tall and the bottom
 * half — under the card's shadow — was tappable.)
 *
 *   ┌─ pill (height H) ─┐
 *   └───────────────────┘
 *        ●  pointer tip   ← bottom of the view → sits on the coordinate
 *
 * Two states:
 *   • resting (unselected) — a white pill leading with a green reward badge, then
 *     the name (badge omitted until the reward estimate exists). A low-budget
 *     business (`isLowBudget`) trails the name with a small danger hourglass —
 *     the map-level form of the "Ending soon" scarcity signal.
 *   • selected — grown + recoloured, name over a reward · reach line. No
 *     hourglass here: danger red is illegible on the ink fill, and the selected
 *     business's carousel card already shows the full "Ending soon" pill.
 *
 * Reward + reach come from the v2 reward projection (`estimatedRewardCents` /
 * `estimatedAverageReach`), which are null until the estimate backend lands —
 * the reward line then simply doesn't render. Money is formatted via
 * `useFormatBudget` (CZK for CZ viewers). All tokens come from the active theme.
 */
export function MapMarkerComponent({
  local,
  isSelected,
  onHeight,
}: {
  local: BusinessPublicPreview;
  isSelected: boolean;
  /** Reports the rendered height (pill + pointer) so the parent <Marker> can set
   * `centerOffset` and anchor the pointer tip on the coordinate. */
  onHeight?: (height: number) => void;
}) {
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  const { t } = useTranslation("map");
  const formatBudget = useFormatBudget();

  const hasReward = typeof local.estimatedRewardCents === "number";
  const reward = hasReward
    ? formatBudget(local.estimatedRewardCents!, { singleCentDigit: true })
    : null;
  const hasReach = local.estimatedAverageReach !== null;

  // Subsidized (platform-funded) businesses get a smaller marker; selection grows
  // it. Report the SCALED height via onHeight so the parent's centerOffset keeps
  // the (now-smaller) pointer tip on the coordinate.
  const scale =
    (isSelected ? 1.04 : 1) * (local.isSubsidizedByPlatform ? 0.85 : 1);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height * scale)}
      style={{
        alignItems: "center",
        backgroundColor: "transparent",
        transform: [{ scale }],
      }}
    >
      {isSelected ? (
        // ── Selected: accent callout, name over reward · reach ────────────────
        <View
          style={{
            maxWidth: 220,
            alignItems: "center",
            backgroundColor: color.ink,
            borderRadius: radius.structure,
            padding: spacing.sm,
            paddingHorizontal: spacing.md,
            boxShadow: shadow.float,
          }}
        >
          <Text
            style={[text.label, { color: color.on.ink, textAlign: "center" }]}
            numberOfLines={1}
          >
            {local.name}
          </Text>
          {reward && (
            <Text
              style={[text.micro, { textAlign: "center" }]}
              numberOfLines={1}
            >
              {/* Only the money value is green; the "cca"/"Earn"/"up to" lead +
                  the reach are tertiary. Differentiated by colour only — the
                  loaded fonts are single-weight, so fontWeight is a no-op. A
                  budget-capped reward leads with "up to" (the amount is an upper
                  bound on a shared budget). */}
              <Text style={{ color: color.text.tertiary }}>
                {t(local.isRewardCapped ? "estPrefixCapped" : "estPrefix")}{" "}
              </Text>
              <Text style={{ color: color.success }}>{reward}</Text>
              {hasReach && (
                <Text style={{ color: color.text.tertiary }}>
                  {" "}
                  {t("forReach", {
                    reach: local.estimatedAverageReach!.toLocaleString(),
                  })}
                </Text>
              )}
            </Text>
          )}
        </View>
      ) : (
        // ── Resting: green price badge leads, name trailing (white pill) ──────
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            maxWidth: 250,
            backgroundColor: color.background,
            borderRadius: radius.structure,
            paddingLeft: reward ? 5 : 14,
            paddingRight: 16,
            paddingVertical: 4,
            boxShadow: shadow.card,
          }}
        >
          {reward && (
            <View
              style={{
                backgroundColor: color.successBg,
                borderRadius: radius.button,
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text
                style={[
                  text.micro,
                  { color: color.success, fontWeight: "600" },
                ]}
              >
                {reward}
              </Text>
            </View>
          )}
          <Text
            style={[
              text.label,
              { color: color.text.primary, fontWeight: "600", flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {local.name}
          </Text>
          {/* Ending-soon scarcity mark — the business may run out of budget and
              disappear soon (see BusinessPreview's pill for the full copy). */}
          {local.isLowBudget && (
            <Ionicons
              name="hourglass-outline"
              size={12}
              color={color.danger}
            />
          )}
        </View>
      )}

      {/* Pointer tip — same fill as the body above it. Bottom of the view; the
          parent's centerOffset puts it on the coordinate. */}
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: isSelected ? color.ink : color.surface,
          marginTop: -3,
        }}
      />
    </View>
  );
}
