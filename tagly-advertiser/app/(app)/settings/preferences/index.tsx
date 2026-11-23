import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  callAuthed,
  pressFeedbackStyle,
  TopMenu,
  useTheme,
  useUserPreferences,
} from "@tagly/client";
import { updateLanguage } from "@tagly/sdk/v2/advertiserApp";

type Language = "en" | "cs";

/**
 * App preferences — the advertiser has a single device-scoped display setting:
 * language (no distance/time toggles the customer carries). The in-app display
 * language is local (instant, via `setDisplayLanguage` → i18next), but we also
 * fire `POST /v2/advertisers/me/update/language` so the backend renders
 * server-sent copy (transactional push + email) in the same language. That call
 * is best-effort — the local switch already gave instant feedback, and the
 * device preference is authoritative for display, so a transient failure only
 * leaves the email/push language momentarily out of sync (callAuthed surfaces
 * the error).
 *
 * The setting is a connected segmented control (a white track lifted by
 * `shadow.chip`, with the selected option an inset `color.ink` pill), headed by
 * an icon + label.
 */
export default function PreferencesSettingsScreen() {
  const { t } = useTranslation("settingsPreferences");
  const { t: ts } = useTranslation("settingsAdvertiser");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const { displayLanguage, setDisplayLanguage, hydrated } = useUserPreferences();

  // Switch the in-app language instantly, then sync the server-side language for
  // push/email (best-effort — display already updated locally).
  const onSelectLanguage = (lang: Language) => {
    if (lang === displayLanguage) return;
    setDisplayLanguage(lang);
    void callAuthed(router, (jwt) =>
      updateLanguage({ jwt, body: { language: lang } }),
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
      {hydrated ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.xl,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
        >
          <PrefBlock icon="language-outline" title={t("languageSection")}>
            <Segmented
              selected={displayLanguage}
              options={[
                { value: "en", label: t("languageEn") },
                { value: "cs", label: t("languageCs") },
              ]}
              onSelect={(v) => onSelectLanguage(v as Language)}
            />
          </PrefBlock>
        </ScrollView>
      ) : null}
    </View>
  );
}

/** A preference block: an icon + label header above its segmented control. */
function PrefBlock({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { color, spacing, text } = theme;
  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Ionicons name={icon} size={18} color={color.text.secondary} />
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * A connected segmented control: a single white track lifted off the cream page
 * by `shadow.chip`, holding equal-width segments. The selected segment is an
 * inset `color.ink` pill (`on.ink` label); unselected segments are transparent
 * over the track (`text.secondary` label). Reads as one control, not floating
 * pills.
 */
function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const { theme } = useTheme();
  const { color, spacing, radius, shadow, text } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.xs,
        padding: spacing.xs,
        backgroundColor: color.surface,
        borderRadius: radius.pill,
        boxShadow: shadow.chip,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(opt.value)}
            style={({ pressed, hovered }) => [
              {
                flex: 1,
                minHeight: 40,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: isSelected ? color.ink : "transparent",
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Text
              style={[
                text.label,
                { color: isSelected ? color.on.ink : color.text.secondary },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
