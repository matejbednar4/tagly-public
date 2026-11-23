import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomActionBar,
  CustomButton,
  hasNotificationsEnabled,
  TopMenu,
  useOnAppResume,
  useTheme,
} from "@tagly/client";
import NotificationSettings from "@/components/settings/NotificationSettings";

/**
 * Push notification preferences (twin of the customer's). Gated on the OS push
 * permission: if it's off (or blocked), we show an "enable in Settings" state
 * instead of the toggles, since preferences are meaningless while the device
 * won't deliver push. The permission is re-checked whenever the app resumes (the
 * user may flip it in the system Settings). When granted, the shared
 * `NotificationSettings` body handles the PUSH channel.
 */
export default function PushNotificationsSettingsScreen() {
  const { t } = useTranslation("settingsNotifications");
  const { t: ts } = useTranslation("settingsAdvertiser");
  const { theme } = useTheme();
  const { color, spacing, layout, radius, text, shadow } = theme;

  const [granted, setGranted] = useState<boolean | null>(null);
  // The pinned action bar overlays the scroll; measure it so the content clears it.
  const [barHeight, setBarHeight] = useState(0);

  const check = useCallback(async () => {
    setGranted(await hasNotificationsEnabled());
  }, []);

  useEffect(() => {
    check();
  }, [check]);
  useOnAppResume(() => {
    check();
  });

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={ts("pushTitle")} subheading={ts("title")} showBack />

      {granted === null ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={color.ink} />
        </View>
      ) : granted ? (
        <NotificationSettings channel="PUSH" />
      ) : (
        <>
          {/* Hero explanation scrolls (and centers when short); the CTA floats in
              the pinned bottom bar — the classic single-action screen layout. */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.lg,
              paddingBottom: barHeight + spacing.xl,
            }}
          >
            <View style={{ alignItems: "center", gap: spacing.lg }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: radius.pill,
                  backgroundColor: color.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: shadow.card,
                }}
              >
                <Ionicons
                  name="notifications-off-outline"
                  size={32}
                  color={color.ink}
                />
              </View>
              <View style={{ alignItems: "center", gap: spacing.xs }}>
                <Text
                  style={[
                    text.title,
                    { color: color.text.primary, textAlign: "center" },
                  ]}
                >
                  {t("permTitle")}
                </Text>
                <Text
                  style={[
                    text.body,
                    { color: color.text.secondary, textAlign: "center" },
                  ]}
                >
                  {t("permBody")}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Pinned action bar (carries the top shadow); button stays flat inside. */}
          <BottomActionBar onHeightChange={setBarHeight}>
            <CustomButton
              type="primary"
              icon="settings-outline"
              label={t("permButton")}
              onPress={() => Linking.openSettings()}
            />
          </BottomActionBar>
        </>
      )}
    </View>
  );
}
