import { ComponentProps } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { BottomSheet, CustomButton, useTheme } from "@tagly/client";

/**
 * Insights-permission explainer — opened by `InstagramConnectionContext` when a
 * connect comes back with 4099 (the `instagram_manage_insights` permission is
 * missing: either unticked on Instagram's consent screen, or the account is
 * personal and can't grant it at all). Instead of a dead-end alert it explains
 * exactly what Tagly does with the permission (read story reach to price the
 * reward — Meta platform terms want this rationale spelled out), notes the
 * professional-account requirement, and offers a "connect again" CTA that
 * re-runs the OAuth flow so the user can grant it.
 */
export default function InstagramPermissionSheet({
  open,
  onClose,
  onReconnect,
}: {
  open: boolean;
  onClose: () => void;
  /** Re-runs the connect flow (the host closes the sheet first). */
  onReconnect: () => void;
}) {
  const { t } = useTranslation("instagramPermission");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("intro")}
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <Text style={[text.heading, { color: color.text.primary }]}>
            {t("pointsHeading")}
          </Text>
          <Row icon="eye-outline" heading={t("readsTitle")} body={t("readsBody")} />
          <Row
            icon="lock-closed-outline"
            heading={t("privacyTitle")}
            body={t("privacyBody")}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <CustomButton
            type="primary"
            label={t("reconnect")}
            icon="logo-instagram"
            onPress={onReconnect}
          />
          <CustomButton type="tertiary" label={t("notNow")} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}

/** One rationale row: accent icon badge + heading and body. */
function Row({
  icon,
  heading,
  body,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  heading: string;
  body: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color.accent,
        }}
      >
        <Ionicons name={icon} size={18} color={color.on.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {heading}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}
