import { useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useTheme, CustomButton, StepProgressOverline } from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";

/**
 * Notifications priming step — shown right after identity is established (OTP or
 * social), before consent, so push reminders can later nudge a dropped-off
 * account. This is our OWN screen: only "Turn on" triggers the OS prompt, so a
 * "Maybe later" never burns iOS's one-shot system prompt. Either choice marks
 * push resolved and advances via `resolveNextRoute`.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation("notifications");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const router = useRouter();
  const { enablePush, skipPush, stepProgress } = useOnboarding();
  const [enabling, setEnabling] = useState(false);
  const progress = stepProgress("push");

  const enable = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      // The action returns the next route (computed from the value it just set).
      router.replace(await enablePush());
    } finally {
      // Normally the replace unmounts this screen, but if enablePush ever
      // throws, both buttons would otherwise stay dead on a step with no back
      // affordance — reset on every exit (same shape as the OTP screen).
      setEnabling(false);
    }
  };

  const skip = () => {
    if (enabling) return;
    router.replace(skipPush());
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <View
        style={{
          flex: 1,
          padding: layout.screenPadding,
          justifyContent: "space-between",
        }}
      >
        {progress && (
          <StepProgressOverline step={progress.step} total={progress.total} />
        )}
        {/* Hero + copy, centered in the upper space. */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xl,
          }}
        >
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: radius.pill,
              backgroundColor: color.brand,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: theme.shadow.card,
            }}
          >
            <Ionicons name="notifications" size={48} color={color.ink} />
          </View>

          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Text
              style={[
                text.title,
                { color: color.text.primary, textAlign: "center" },
              ]}
            >
              {t("heading")}
            </Text>
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("body")}
            </Text>
          </View>
        </View>

        {/* Actions pinned to the bottom; skip is a subtle link, not a button. */}
        <View style={{ gap: spacing.md }}>
          <CustomButton
            type="primary"
            label={t("enable")}
            onPress={enable}
            loading={enabling}
          />
          <CustomButton
            type="tertiary"
            label={t("skip")}
            onPress={skip}
            disabled={enabling}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
