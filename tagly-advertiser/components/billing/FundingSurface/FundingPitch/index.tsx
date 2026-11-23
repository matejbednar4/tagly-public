import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme, CustomButton } from "@tagly/client";
import { MethodHeader } from "@/components/billing/shared/MethodHeader";
import { MethodBenefits } from "@/components/billing/shared/MethodBenefits";

/**
 * The never-funded state — the ONE place the wallet is allowed to sell, and
 * the only screen an advertiser sees during the onboarding payment step.
 *
 * The fork is deliberately two options, not three: the real decision is
 * **prepay or pay per share**. The monthly top-up is an optimisation of
 * prepaying, so it is offered right after the first purchase (as a row in
 * "How you pay") rather than competing here — a third option at the moment of
 * the first decision is a third thing to understand for no extra choice.
 *
 * Credits lead as a full card; pay as you go follows its lead-in as the
 * compact, `secondary`-CTA alternative, which also keeps the screen at one
 * primary button.
 */
export function FundingPitch({
  onAddCredits,
  onPayg,
}: {
  onAddCredits: () => void;
  onPayg: () => void;
}) {
  const { t } = useTranslation("fundingSurface");
  const { t: tb } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;

  return (
    <View style={{ gap: spacing.lg }}>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
          gap: spacing.lg,
        }}
      >
        <MethodHeader method="credits" />
        <MethodBenefits method="credits" />
        <CustomButton
          type="primary"
          label={tb("credits.cta")}
          icon="add"
          onPress={onAddCredits}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {t("paygLeadIn")}
        </Text>
        <View
          style={{
            backgroundColor: color.surface,
            borderRadius: radius.structure,
            padding: layout.cardPaddingCompact,
            boxShadow: shadow.card,
            gap: spacing.md,
          }}
        >
          <MethodHeader method="payg" />
          <CustomButton
            type="secondary"
            label={tb("payg.cta")}
            icon="flash-outline"
            onPress={onPayg}
          />
        </View>
      </View>
    </View>
  );
}
