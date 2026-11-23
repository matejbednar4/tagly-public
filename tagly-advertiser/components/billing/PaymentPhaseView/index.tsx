import { ActivityIndicator, View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, CustomButton } from "@tagly/client";

/**
 * The post-payment phase a billing sheet is in once the form is submitted and
 * the PaymentSheet reported success. `verifying` = polling the backend for the
 * money truth; `success` = confirmed, showing the beat; `unverified` = the
 * poll budget ran out without an answer.
 */
export type PaymentVerifyPhase = "verifying" | "success" | "unverified";

/**
 * Shared post-payment state view for the billing sheets (`PaygSheet`,
 * `AddCreditsSheet`): a centered icon moment (spinner while verifying, green
 * check on success, butter clock when unverified) with a title + supporting
 * line. Strings come from the owning sheet's namespace via props; the
 * unverified state gets a single dismiss CTA.
 */
export function PaymentPhaseView({
  phase,
  title,
  body,
  ctaLabel,
  onCtaPress,
}: {
  phase: PaymentVerifyPhase;
  title: string;
  body: string;
  /** Dismiss CTA, rendered only for the `unverified` phase. */
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;

  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.xl,
        paddingVertical: spacing.xl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor:
            phase === "success"
              ? color.successBg
              : phase === "unverified"
                ? color.brand
                : color.surface,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: shadow.card,
        }}
      >
        {phase === "verifying" ? (
          <ActivityIndicator size="large" color={color.ink} />
        ) : phase === "success" ? (
          <Ionicons name="checkmark" size={36} color={color.success} />
        ) : (
          <Ionicons name="time-outline" size={32} color={color.on.brand} />
        )}
      </View>
      <View style={{ gap: spacing.sm, alignItems: "center" }}>
        <Text
          style={[
            text.heading,
            { color: color.text.primary, textAlign: "center" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            text.body,
            { color: color.text.secondary, textAlign: "center" },
          ]}
        >
          {body}
        </Text>
      </View>
      {phase === "unverified" && ctaLabel && onCtaPress ? (
        <View style={{ alignSelf: "stretch" }}>
          <CustomButton type="primary" label={ctaLabel} onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}
