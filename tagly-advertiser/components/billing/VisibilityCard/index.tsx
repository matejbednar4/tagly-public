import { useState } from "react";
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme, pressFeedbackStyle } from "@tagly/client";
import { NotVisibleStamp } from "@/components/billing/BudgetCard";
import { VisibilitySheet } from "@/components/billing/VisibilitySheet";
import { useVisibilityCause } from "@/components/billing/shared/useVisibilityCause";

/**
 * VisibilityCard — the standalone "NOT VISIBLE" strip for screens that don't
 * carry the `BudgetCard` (Wallet, Account): the same tappable danger band
 * (stamp + info glyph → the self-owned `VisibilitySheet` with the specific
 * cause from `useVisibilityCause`), as its own card. Renders nothing while the
 * advertiser is visible, so hosts can mount it unconditionally — a business
 * that's dark sees why on every money/identity surface, a healthy one sees no
 * noise.
 */
export function VisibilityCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation("visibilityCard");
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow } = theme;
  const [sheetOpen, setSheetOpen] = useState(false);

  const cause = useVisibilityCause();
  if (cause === null) return null;

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        style={[
          {
            backgroundColor: color.dangerBg,
            borderRadius: radius.structure,
            boxShadow: shadow.card,
            padding: layout.cardPadding,
            minHeight: layout.minTapTarget,
            justifyContent: "center",
          },
          style,
        ]}
      >
        {/* Press feedback rides the inner content so the tinted card stays
            flush (same pattern as the BudgetCard band). */}
        {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <NotVisibleStamp label={t("notVisible")} />
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={color.on.dangerBg}
            />
          </View>
        )}
      </Pressable>
      <VisibilitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cause={cause}
      />
    </>
  );
}
