import { useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  useTheme,
  CustomButton,
  StepProgressOverline,
  BottomActionBar,
} from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";

/**
 * Marketing-consent step — shown to **every** locale (no US auto-opt-in; see
 * v2.0.0.md §7). Records explicit, unbundled consent for a **single** combined
 * marketing flag (email + push) via `saveMarketingConsent`, then advances.
 * Deliberately mirrors the notifications step's layout but with an **accent** hero
 * (vs the notifications **brand** hero) and copy that flags it as a *separate* ask
 * (optional promotions, not the transactional alerts) so it doesn't read as a
 * repeat. Both choices are recorded — "No thanks" is a real, clear option.
 */
export default function ConsentScreen() {
  const { t } = useTranslation("consent");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const router = useRouter();
  const { saveConsent, stepProgress } = useOnboarding();
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  // The pinned BottomActionBar overlays the content; reserve its measured height
  // as bottom padding so the centered hero never sits under it.
  const [barHeight, setBarHeight] = useState(0);
  const progress = stepProgress("consent");

  const choose = async (enabled: boolean) => {
    if (pending) return;
    setPending(enabled ? "allow" : "deny");
    const next = await saveConsent(enabled); // next route, or null on failure
    if (next) router.replace(next);
    else setPending(null);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: color.background }}
    >
      <View
        style={{
          flex: 1,
          padding: layout.screenPadding,
          paddingBottom: barHeight + spacing.lg,
        }}
      >
        {progress && (
          <StepProgressOverline step={progress.step} total={progress.total} />
        )}
        {/* Hero + copy, centered in the remaining space. */}
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
              backgroundColor: color.accent,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: theme.shadow.card,
            }}
          >
            <Ionicons name="megaphone" size={48} color={color.ink} />
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
      </View>

      {/* Actions in the shared pinned bar (top shadow, owns the bottom safe-area
          inset); "No thanks" stays a clear option. */}
      <BottomActionBar onHeightChange={setBarHeight} gap={spacing.md}>
        <CustomButton
          type="primary"
          label={t("allow")}
          loading={pending === "allow"}
          disabled={pending !== null}
          onPress={() => choose(true)}
        />
        <CustomButton
          type="tertiary"
          label={t("deny")}
          onPress={() => choose(false)}
          loading={pending === "deny"}
          disabled={pending !== null}
        />
      </BottomActionBar>
    </SafeAreaView>
  );
}
