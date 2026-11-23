import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  BottomSheet,
  useTheme,
  formatBudget,
  useFormatBudget,
} from "@tagly/client";
import { PAYG, VISIBILITY_BUDGETS } from "@tagly/models/shared";
import {
  MethodChip,
  type FundingMethod,
} from "@/components/billing/shared/MethodHeader";
import type { VisibilityCause } from "@/components/billing/shared/useVisibilityCause";

/**
 * VisibilitySheet — the "how visibility works" explainer, opened by tapping the
 * NOT VISIBLE danger band (`BudgetCard`, `NoBusinessCard`, `VisibilityCard`).
 * Visibility needs two things — a business page, and budget to reward customers
 * for sharing — so the sheet teaches both, surfaces the specific reason the
 * business is dark right now (the `cause` key picks the `<cause>Body` prose,
 * derived by `useVisibilityCause`), and lays out the ways back: the create-page
 * step first when the page is the blocker, then the two funding methods.
 *
 * Self-contained (own `open`/`onClose`); it owns all the cause prose so every
 * surface that names a cause reads identically.
 */

const METHODS = ["credits", "payg"] as const;

export function VisibilitySheet({
  open,
  onClose,
  cause,
}: {
  open: boolean;
  onClose: () => void;
  /** Why the business is not visible right now (see `useVisibilityCause`). */
  cause: VisibilityCause;
}) {
  const { t } = useTranslation("visibilitySheet");
  // Method titles come from the shared billing namespace — the single source
  // of truth for what each funding method is called.
  const { t: tBilling } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const formatBudgetLocalized = useFormatBudget();
  const surcharge = formatBudget(PAYG.SURCHARGE_CENTS);
  const min = formatBudgetLocalized(
    VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS,
    { forcedCurrency: "USD", showCents: false },
  );

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("intro")}
          </Text>
        </View>

        {/* Why you're dark right now — a danger-tinted callout carrying the
            specific cause. */}
        <View
          style={{
            backgroundColor: color.dangerBg,
            borderRadius: radius.structure,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={color.on.dangerBg}
            />
            <Text
              style={[
                text.label,
                {
                  color: color.on.dangerBg,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                },
              ]}
            >
              {t("reasonHeading")}
            </Text>
          </View>
          <Text style={[text.body, { color: color.on.dangerBg }]}>
            {t(`${cause}Body`, { min })}
          </Text>
        </View>

        {/* The ways back to visible. When the page is the blocker, the
            create-page step leads and the funding methods follow (they'll be
            the very next thing the business needs). */}
        <View style={{ gap: spacing.md }}>
          <Text style={[text.heading, { color: color.text.primary }]}>
            {t("waysTitle")}
          </Text>
          {cause === "noPage" ? (
            <WayRow
              chip={
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: color.ink,
                  }}
                >
                  <Ionicons
                    name="storefront-outline"
                    size={20}
                    color={color.on.ink}
                  />
                </View>
              }
              title={t("page.title")}
              body={t("page.body")}
            />
          ) : null}
          {METHODS.map((m) => (
            <WayRow
              key={m}
              chip={<MethodChip method={m as FundingMethod} />}
              title={tBilling(`${m}.title`)}
              body={t(`${m}.body`, { surcharge })}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

/** One way back to visible: an identity chip + title/body. Funding methods use
 *  their canonical `MethodChip`; the create-page step gets an ink chip. */
function WayRow({
  chip,
  title,
  body,
}: {
  chip: React.ReactNode;
  title: string;
  body: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {chip}
      <View style={{ flex: 1, gap: 2, paddingTop: spacing.xs }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}
