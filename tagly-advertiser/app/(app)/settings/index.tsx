import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  openPrivacyPolicy,
  openTermsOfService,
  TopMenu,
  useTheme,
} from "@tagly/client";
import {
  SettingsSection,
  SettingsRow,
} from "@/components/settings/SettingsList";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";

/**
 * Settings hub — the drawer's "Settings" entry (twin of the customer settings
 * hub). A grouped list of the account's surfaces: account & security (email,
 * security, referrals), the business-pages section, preferences (language),
 * notifications (push + email), the legal section (Privacy Policy + Terms of Service,
 * external links), and the danger zone (delete account). Internal rows drill
 * into their own screen; the legal rows open an external link. Log out lives in
 * the drawer, not here. The grouped-list pattern is the shared
 * `SettingsSection`/`SettingsRow` (also used by the per-business hub).
 */
export default function SettingsScreen() {
  const { t } = useTranslation("settingsAdvertiser");
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const { advertiser } = useAdvertiser();

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + layout.screenPadding,
          gap: spacing.xl,
        }}
      >
        <SettingsSection title={t("accountSection")}>
          <SettingsRow
            icon="mail-outline"
            label={t("email")}
            subtitle={advertiser?.email}
            href="/settings/email"
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t("security")}
            href="/settings/security"
          />
          <SettingsRow
            icon="gift-outline"
            label={t("referrals")}
            subtitle={t("referralsSub")}
            href="/settings/referrals"
          />
        </SettingsSection>

        <SettingsSection title={t("businessSection")}>
          <SettingsRow
            icon="storefront-outline"
            label={t("businessPages")}
            subtitle={t("businessPagesSubtitle")}
            href="/businesses"
          />
        </SettingsSection>

        <SettingsSection title={t("preferencesSection")}>
          <SettingsRow
            icon="language-outline"
            label={t("language")}
            href="/settings/preferences"
          />
        </SettingsSection>

        <SettingsSection title={t("notificationsSection")}>
          <SettingsRow
            icon="notifications-outline"
            label={t("pushNotifications")}
            href="/settings/notifications/push"
          />
          <SettingsRow
            icon="mail-outline"
            label={t("emailNotifications")}
            href="/settings/notifications/email"
          />
        </SettingsSection>

        <SettingsSection title={t("legalSection")}>
          <SettingsRow
            icon="lock-closed-outline"
            label={t("privacyPolicy")}
            onPress={openPrivacyPolicy}
            external
          />
          <SettingsRow
            icon="document-text-outline"
            label={t("termsOfService")}
            onPress={openTermsOfService}
            external
          />
        </SettingsSection>

        <SettingsSection title={t("dangerSection")}>
          <SettingsRow
            icon="trash-outline"
            label={t("deleteAccount")}
            href="/settings/delete"
            danger
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
