import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { TopMenu, useTheme } from "@tagly/client";
import NotificationSettings from "@/components/settings/NotificationSettings";

/**
 * Email notification preferences (twin of the customer's). No OS-permission gate
 * (unlike push) — email is always deliverable — so the shared
 * `NotificationSettings` body renders the EMAIL channel directly.
 */
export default function EmailNotificationsSettingsScreen() {
  const { t } = useTranslation("settingsAdvertiser");
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      <TopMenu title={t("emailTitle")} subheading={t("title")} showBack />
      <NotificationSettings channel="EMAIL" />
    </View>
  );
}
