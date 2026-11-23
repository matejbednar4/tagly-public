import { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  CustomButton,
  StepProgressOverline,
  customAlert,
} from "@tagly/client";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useSetupProgress } from "@/hooks/useSetupProgress";
import { useAnalytics } from "@/utils/analytics";
import { FundingSurface } from "@/components/billing/FundingSurface";

/**
 * Setup · payment step — the skippable funding step. Its body is the **exact
 * same `FundingSurface` the Wallet tab mounts** (Matej, 2026-09-02): this
 * screen declares no card, no sheet and no funding copy of its own, so
 * onboarding and the Wallet cannot drift apart. All it adds is step chrome —
 * the progress overline, the title, and the skip.
 *
 * Every account routed here is unfunded by definition, so the surface renders
 * its pitch state: the prepay-or-pay-per-share fork. The monthly top-up is
 * deliberately not a third option — it is an optimisation of prepaying, so the
 * surface offers it right AFTER the first purchase, here as on every other
 * surface (Matej, 2026-09-03).
 *
 * That prompt is why this step must not resolve itself. The gate it lives
 * behind (`paymentSetupPending`) **latches once entered**: the sheet's own /me
 * refresh flips `funded` true while the success beat is still playing, and
 * without the latch the guard swapped this screen out mid-beat — the
 * confirmation was cut off, `onFunded` never fired (its timer dies with the
 * unmount) and the top-up was never offered. Now the step ends where it should:
 * `onFunded`, which the surface holds until every sheet has closed.
 *
 * So `onFunded` fires only after the backend confirmed the money, the sheet
 * played its success beat, and the advertiser answered whatever came next —
 * resolving the step here means real money truth. The surface re-pulls /me
 * BEFORE calling back: `AdvertiserContext` fetches /me once at mount, so
 * dismissing on the boot cache would land a just-charged advertiser on a stale
 * "NOT VISIBLE / $0.00" card (E048). Skip resolves the step instantly; the
 * Wallet tab is the permanent second chance.
 */
export default function SetupPaymentScreen() {
  const { t } = useTranslation("setupPayment");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const { dismissPaymentSetup } = useAdvertiser();
  const { track } = useAnalytics();
  const insets = useSafeAreaInsets();
  // Continues the onboarding count ("3 of 4" fresh flow, "1 of 2" plain login).
  const progress = useSetupProgress(1);

  useEffect(() => {
    // Fire once per mount — the funnel's step denominator. The gate only
    // routes unfunded+undismissed accounts here, so every mount is a real view.
    track("setup_payment_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skipping funding means the business is created but invisible until money is
  // added — confirm so it's never an accidental tap.
  const skip = () => {
    customAlert(t("skipAlertTitle"), t("skipAlertBody"), [
      { text: t("skipAlertCancel"), style: "cancel", onPress: () => {} },
      {
        text: t("skipAlertConfirm"),
        style: "destructive",
        onPress: () => {
          track("setup_payment_skipped");
          dismissPaymentSetup(); // flips the (app) gate
        },
      },
    ]);
  };

  // No refresh needed here: `useConfirmedExit` inside the sheet awaits the /me
  // refresh before calling back, so the gate never flips on a stale boot cache
  // (E048) — the guarantee now holds for every host by construction.
  const onFunded = () => dismissPaymentSetup();

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      {/* Scrolls when the cards + copy don't fit (small screens / large text),
          with the skip pinned to the bottom on tall screens. The scroll content
          pads the safe-area insets itself (no SafeAreaView), so content scrolls
          under the notch / home indicator instead of being clipped. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: layout.screenPadding,
          paddingTop: insets.top + layout.screenPadding,
          paddingBottom: insets.bottom + layout.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {progress && (
          <StepProgressOverline step={progress.step} total={progress.total} />
        )}
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("subtitle")}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <FundingSurface surface="setup" onFunded={onFunded} />
        </View>

        <View style={{ marginTop: "auto", paddingTop: spacing.lg }}>
          <CustomButton type="tertiary" label={t("skip")} onPress={skip} />
        </View>
      </ScrollView>
    </View>
  );
}
