import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { callAuthed, CustomButton, TopMenu, useTheme } from "@tagly/client";
import {
  createExpressDashboardLink,
  getConnectStatus,
} from "@tagly/sdk/v2/customerApp";
import type { GetConnectStatusResponse } from "@tagly/models/v2/customerApp";

/**
 * Stripe (payouts) settings — read-only status of the customer's Stripe Connect
 * account plus the actions to progress or manage it. State comes from
 * `GET /v2/customers/me/cash-out/connect-status` ({ hasAccount, payoutsEnabledAt }),
 * the same webhook-maintained DB values the cash-out flow reads (no Stripe
 * round-trip here — the `/withdraw` screen already `sync`s on onboarding return).
 * Re-read on every focus so returning from `/withdraw` reflects a fresh connect.
 *
 * Three states:
 *  - **No account** → a hero + "Set up payouts", routing to `/withdraw` (where the
 *    region gate + Connect onboarding live).
 *  - **Account, payouts pending** → status card + "Finish setup" → `/withdraw`.
 *  - **Payouts enabled** → status card + "Manage in Stripe", opening a one-time
 *    Express Dashboard login link (`POST .../dashboard-link`) in the browser.
 */
export default function StripeSettingsScreen() {
  const { t } = useTranslation("settingsStripe");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow, text } = theme;

  const [status, setStatus] = useState<GetConnectStatusResponse | null>(null);
  const [managing, setManaging] = useState(false);

  // Cheap DB read (webhook-maintained); refreshed on focus so a just-completed
  // onboarding in `/withdraw` shows here without a manual reload.
  const refetch = useCallback(async () => {
    const res = await callAuthed(router, (jwt) => getConnectStatus({ jwt }));
    if (res.ok && res.data) setStatus(res.data);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Open the one-time Express Dashboard login link (payout history + bank details).
  const openDashboard = async () => {
    if (managing) return;
    setManaging(true);
    const res = await callAuthed(router, (jwt) =>
      createExpressDashboardLink({ jwt }),
    );
    if (!res.ok || !res.data) {
      setManaging(false);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(res.data.url);
    } catch {
      // Swallow — nothing to reconcile; the link is one-time and read-only.
    }
    setManaging(false);
  };

  const header = (
    <TopMenu title={t("title")} subheading={ts("title")} showBack />
  );

  if (!status) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        {header}
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={color.ink} />
        </View>
      </View>
    );
  }

  // No Connect account yet — a hero + CTA into the /withdraw onboarding flow.
  if (!status.hasAccount) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        {header}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.xl,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
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
              }}
            >
              <Ionicons name="card-outline" size={32} color={color.ink} />
            </View>
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <Text
                style={[
                  text.title,
                  { color: color.text.primary, textAlign: "center" },
                ]}
              >
                {t("notConnectedTitle")}
              </Text>
              <Text
                style={[
                  text.body,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
              >
                {t("notConnectedBody")}
              </Text>
            </View>
          </View>
          <View style={{ width: "100%" }}>
            <CustomButton
              type="primary"
              icon="cash-outline"
              label={t("setUpCta")}
              onPress={() => router.push("/withdraw")}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // Account exists: show its status, then either finish setup or manage in Stripe.
  const payoutsEnabled = !!status.payoutsEnabledAt;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      {header}
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
        {/* Status card — connection + payout readiness, separated by a hairline. */}
        <View
          style={{
            backgroundColor: color.surface,
            borderRadius: radius.structure,
            boxShadow: shadow.card,
            overflow: "hidden",
          }}
        >
          <StatusRow
            label={t("accountRow")}
            value={t("accountConnected")}
            icon="checkmark-circle"
            tint={color.success}
          />
          <View
            style={{
              height: 1,
              marginHorizontal: layout.cardPadding,
              backgroundColor: color.border.divider,
            }}
          />
          <StatusRow
            label={t("payoutsRow")}
            value={payoutsEnabled ? t("payoutsEnabled") : t("payoutsPending")}
            icon={payoutsEnabled ? "checkmark-circle" : "time-outline"}
            tint={payoutsEnabled ? color.success : color.text.tertiary}
          />
        </View>

        <Text style={[text.body, { color: color.text.secondary }]}>
          {payoutsEnabled ? t("manageBody") : t("pendingBody")}
        </Text>

        {payoutsEnabled ? (
          <CustomButton
            type="primary"
            icon="open-outline"
            label={t("manageCta")}
            loading={managing}
            onPress={openDashboard}
          />
        ) : (
          <CustomButton
            type="primary"
            icon="arrow-forward"
            label={t("finishSetupCta")}
            onPress={() => router.push("/withdraw")}
          />
        )}
      </ScrollView>
    </View>
  );
}

/** One status card row: a left label and a right status value with a leading icon. */
function StatusRow({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout, text } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        minHeight: 56,
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={[text.bodyMedium, { color: color.text.primary }]}>
        {label}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      >
        <Ionicons name={icon} size={18} color={tint} />
        <Text style={[text.label, { color: tint }]}>{value}</Text>
      </View>
    </View>
  );
}
