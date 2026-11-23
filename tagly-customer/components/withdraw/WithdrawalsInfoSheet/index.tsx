import { ComponentProps } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { BottomSheet, useTheme } from "@tagly/client";

/**
 * "How withdrawals work" explainer — a bottom sheet with the 3-step path (Tagly
 * balance → Stripe account → your bank), each with an icon and *when* it happens.
 * Opened from the withdraw form; the per-withdrawal *statuses* are explained on
 * each transaction row itself. Purely informational; `open`/`onClose` are owned by
 * the host.
 */
export default function WithdrawalsInfoSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("withdrawalsInfo");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[text.title, { color: color.text.primary }]}>
        {t("title")}
      </Text>

      {/* The path, step by step. */}
      <View style={{ gap: spacing.lg }}>
        <StepRow icon="wallet-outline" text={t("step1")} />
        <StepRow icon="business-outline" text={t("step2")} />
        <StepRow icon="checkmark-circle-outline" text={t("step3")} />
      </View>
    </BottomSheet>
  );
}

/** One step: an accent icon badge + text. */
function StepRow({
  icon,
  text: body,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
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
      <Text style={[text.body, { color: color.text.secondary, flex: 1 }]}>
        {body}
      </Text>
    </View>
  );
}
