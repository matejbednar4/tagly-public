import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  callAuthed,
  customAlert,
  EditableSetting,
  SectionHeader,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { updateName } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import { GenderField } from "@/components/settings/GenderField";
import { InterestsField } from "@/components/settings/InterestsField";

/**
 * Profile settings — the logged-in customer's editable details on one screen.
 * Name edits inline (via `EditableSetting` → `POST /v2/customers/me/update/name`);
 * email is read-only here and launches the dedicated change-email flow (dual OTP).
 * Gender + follower interests land next (they need their own cooldown-gated
 * endpoints + controls). The IG avatar/handle are intentionally not shown here —
 * they're Instagram-owned and managed under Connected accounts.
 */
export default function ProfileSettingsScreen() {
  const { t } = useTranslation("settingsProfile");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const { customer, setCustomer } = useCustomer();

  const saveName = async (fullName: string): Promise<boolean> => {
    const res = await callAuthed(
      router,
      (jwt) => updateName({ jwt, body: { fullName } }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok || !res.data) {
      const code = !res.ok ? res.error?.error.code : undefined;
      // 4951 = the profanity gate (the name is shown to advertisers/admins).
      if (code === 4951) {
        customAlert(t("nameFlaggedTitle"), t("nameFlaggedBody"));
      } else if (typeof code === "number" && code >= 1000) {
        customAlert(t("nameSaveFailedTitle"), t("nameSaveFailedBody"));
      }
      return false;
    }
    const saved = res.data.fullName;
    setCustomer((prev) => (prev ? { ...prev, fullName: saved } : prev));
    return true;
  };

  if (!customer) return null;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        // bottomOffset is measured to the caret, not the field's bottom, so it
        // must clear ~half the input height (56) + a gap or the field's lower
        // half hides behind the keyboard.
        bottomOffset={spacing["3xl"]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + layout.screenPadding,
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("detailsSection")} />
          <View style={{ gap: spacing.md }}>
            <EditableSetting
              icon="person-outline"
              heading={t("nameHeading")}
              value={customer.fullName}
              placeholder={t("namePlaceholder")}
              autoCapitalize="words"
              maxLength={100}
              validate={(v) => (v.length < 1 ? t("nameRequired") : null)}
              onSave={saveName}
            />
            <EditableSetting
              icon="mail-outline"
              heading={t("emailHeading")}
              value={customer.email}
              actionLabel={t("changeEmail")}
              onAction={() => router.push("/settings/email")}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("aboutSection")} />
          <View style={{ gap: spacing.md }}>
            <GenderField />
            <InterestsField />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
