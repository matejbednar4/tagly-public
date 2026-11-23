import { Children, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  openPrivacyPolicy,
  openTermsOfMonetization,
  openTermsOfService,
  pressFeedbackStyle,
  SectionHeader,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { useCustomer } from "@/contexts/Customer";
import StoryViewsModal from "@/components/storyViews/StoryViewsModal";

/** Row icon size — the between-row divider is inset to line up past it. */
const ROW_ICON_SIZE = 22;

/**
 * Uniform row height. Every row is this tall — with or without a subtitle — so
 * the list reads as an even grid; it's sized to fit the two-line label+subtitle
 * variant with comfortable vertical centering, and single-line rows center in
 * the same box.
 */
const ROW_MIN_HEIGHT = 64;

/**
 * Settings hub — the drawer's "Settings" entry. A grouped list of the account's
 * surfaces (profile · security · connected accounts · preferences ·
 * notifications · legal · delete). Internal rows drill into their own screen;
 * the legal rows open an external link. Most sub-screens are shells today and
 * land slice-by-slice (see v2.0.0.md). Log out lives in the drawer, not here.
 */
export default function SettingsScreen() {
  const { t } = useTranslation("settings");
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;

  const { customer } = useCustomer();
  const storyViews = customer?.estimatedStoryViews ?? null;
  const [storyViewsOpen, setStoryViewsOpen] = useState(false);

  // The story-views estimate only feeds reward projections while there are no
  // real Instagram insights, so the row is offered to no-IG customers only —
  // once linked, the estimate is unused (and cleared). Subtitle shows the
  // current value so they can see what to adjust.
  const showStoryViews = !!customer && !customer.instagram;
  const storyViewsSub =
    typeof storyViews === "number"
      ? t("storyViewsSet", { views: storyViews })
      : t("storyViewsUnset");

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
            icon="person-outline"
            label={t("profile")}
            subtitle={t("profileSub")}
            href="/settings/profile"
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

        <SettingsSection title={t("connectedSection")}>
          <SettingsRow
            icon="logo-instagram"
            label={t("instagram")}
            href="/settings/instagram"
          />
          <SettingsRow
            icon="card-outline"
            label={t("stripe")}
            subtitle={t("stripeSub")}
            href="/settings/stripe"
          />
        </SettingsSection>

        <SettingsSection title={t("preferencesSection")}>
          <SettingsRow
            icon="options-outline"
            label={t("appPreferences")}
            href="/settings/preferences"
          />
          {showStoryViews ? (
            <SettingsRow
              icon="eye-outline"
              label={t("storyViews")}
              subtitle={storyViewsSub}
              onPress={() => setStoryViewsOpen(true)}
            />
          ) : null}
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
          <SettingsRow
            icon="cash-outline"
            label={t("termsOfMonetization")}
            onPress={openTermsOfMonetization}
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

      <StoryViewsModal
        open={storyViewsOpen}
        onClose={() => setStoryViewsOpen(false)}
        allowCancel
      />
    </View>
  );
}

/**
 * A titled group of rows rendered as one shadow card (no border — separation is
 * `shadow.card`), with a hairline divider between rows inset to align under the
 * row labels.
 */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow } = theme;
  const rows = Children.toArray(children);

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} />
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginLeft: layout.cardPadding + ROW_ICON_SIZE + spacing.md,
                  backgroundColor: color.border.divider,
                }}
              />
            ) : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One settings row: an ink (or danger) icon + label (with an optional subtitle
 * that explains what the row leads to), and a trailing chevron for internal
 * drill-ins or an `open` glyph for external links. Pass `href` to navigate, or
 * `onPress` for a link / custom action.
 */
function SettingsRow({
  icon,
  label,
  subtitle,
  href,
  onPress,
  external = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const tint = danger ? color.danger : color.ink;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={href ? () => router.push(href) : onPress}
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
          gap: spacing.md,
          minHeight: ROW_MIN_HEIGHT,
          paddingHorizontal: layout.cardPadding,
          paddingVertical: spacing.sm,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name={icon} size={ROW_ICON_SIZE} color={tint} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            text.bodyMedium,
            // Tighten the leading so the subtitle sits right under the label.
            {
              color: danger ? color.danger : color.text.primary,
              lineHeight: 20,
            },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={external ? "open-outline" : "chevron-forward"}
        size={external ? 16 : 18}
        color={color.text.tertiary}
      />
    </Pressable>
  );
}
