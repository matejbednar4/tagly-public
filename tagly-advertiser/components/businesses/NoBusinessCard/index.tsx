import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useTheme, pressFeedbackStyle } from "@tagly/client";
import {
  NotVisibleStamp,
  CardFooterCta,
} from "@/components/billing/BudgetCard";
import { VisibilitySheet } from "@/components/billing/VisibilitySheet";

/**
 * The "create your business page" prompt card — shown in place of the
 * `BudgetCard` while the advertiser has no business page (money isn't the
 * blocker, so there's no ledger). Deliberately a separate component: apart
 * from sharing the stamp + ink footer pieces, it has nothing in common with
 * the budget/visibility card. The NOT VISIBLE stamp sits in the same tappable
 * full-width danger band as the broken `BudgetCard` — opening the
 * `VisibilitySheet` with the no-page cause — so "not visible" reads and
 * behaves identically wherever it appears.
 */
export function NoBusinessCard() {
  const { t } = useTranslation("noBusinessCard");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {/* Danger band — the same tappable stamp strip as the broken
            BudgetCard; opens the visibility explainer with the no-page cause.
            Press feedback rides the inner content so the tinted strip stays
            flush to the card edges. */}
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          style={{
            backgroundColor: color.dangerBg,
            padding: layout.cardPadding,
          }}
        >
          {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
            <View
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
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
        <View style={{ padding: layout.cardPadding, gap: spacing.sm }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {t("body")}
          </Text>
        </View>
        <CardFooterCta
          icon="add"
          label={t("cta")}
          onPress={() => router.push("/businesses/create")}
        />
      </View>
      <VisibilitySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cause="noPage"
      />
    </>
  );
}
