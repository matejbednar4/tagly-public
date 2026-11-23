import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { pressFeedbackStyle, SupportSheet, useTheme } from "@tagly/client";

/**
 * The "this page was suspended" notice shown to the OWNER of a BANNED business
 * (`BusinessOwnerDetails.status === "BANNED"`) — on the business detail screen
 * and the per-business settings hub. A banned page stays visible to its owner
 * but is hidden from customers and read-only (edit/delete refuse server-side),
 * so this is the one honest explanation of why nothing is editable.
 *
 * Soft danger surface (`dangerBg` + `on.dangerBg`, never solid danger — same
 * treatment as the "Ending soon" pill); tapping it opens the shared
 * `SupportSheet` tagged `banned-business` so the owner can appeal.
 */
export function BannedBusinessNotice() {
  const { t } = useTranslation("bannedBusinessNotice");
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout } = theme;
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setSupportOpen(true)}
        accessibilityRole="button"
        style={({
          pressed,
          hovered,
        }: {
          pressed: boolean;
          hovered?: boolean;
        }) => [
          {
            backgroundColor: color.dangerBg,
            borderRadius: radius.structure,
            padding: layout.cardPadding,
            gap: spacing.xs,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={color.on.dangerBg}
          />
          <Text style={[text.bodyMedium, { color: color.on.dangerBg }]}>
            {t("title")}
          </Text>
        </View>
        <Text style={[text.caption, { color: color.on.dangerBg }]}>
          {t("body")}
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Text style={[text.label, { color: color.on.dangerBg }]}>
            {t("contactSupport")}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={color.on.dangerBg}
          />
        </View>
      </Pressable>

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="banned-business"
      />
    </>
  );
}
