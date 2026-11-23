import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  callAuthed,
  customAlert,
  CustomButton,
  SectionHeader,
  showToast,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { signOutOtherSessions } from "@tagly/sdk/v2/customerApp";
import { useSession } from "@/contexts/session/SessionContext";

/**
 * Security settings — session management. "Sign out of all other devices" bumps
 * the customer's token version server-side (every other session's JWT stops
 * validating) and persists the fresh token the endpoint returns, so THIS device
 * stays signed in.
 */
export default function SecuritySettingsScreen() {
  const { t } = useTranslation("settingsSecurity");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const { refreshJwt } = useSession();
  const [loading, setLoading] = useState(false);

  const signOutOthers = async () => {
    setLoading(true);
    const res = await callAuthed(router, (jwt) =>
      signOutOtherSessions({ jwt }),
    );
    setLoading(false);
    if (!res.ok || !res.data) return;
    await refreshJwt(res.data.token);
    showToast({
      type: "success",
      text1: t("signedOutTitle"),
      text2: t("signedOutBody"),
    });
  };

  const confirm = () => {
    if (loading) return;
    customAlert(t("confirmTitle"), t("confirmBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirmAction"),
        style: "destructive",
        onPress: () => void signOutOthers(),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
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
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("sessionsSection")} />
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
              boxShadow: shadow.card,
              gap: spacing.md,
            }}
          >
            <Text style={[text.bodyMedium, { color: color.text.primary }]}>
              {t("signOutAllHeading")}
            </Text>
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {t("signOutAllDescription")}
            </Text>
            <CustomButton
              type="destructive"
              label={t("signOutAllButton")}
              loading={loading}
              onPress={confirm}
              icon="log-out-outline"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
