import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import {
  BottomActionBar,
  callAuthed,
  customAlert,
  CustomButton,
  showToast,
  SupportSheet,
  TopMenu,
  useBusinessMapCache,
  useTheme,
} from "@tagly/client";
import {
  getConnectStatus,
  startConnectOnboarding,
  updateLocale,
} from "@tagly/sdk/v2/customerApp";
import type { GetConnectStatusResponse } from "@tagly/models/v2/customerApp";
import type { SupportedLocale } from "@tagly/models/shared";
import { useCustomer } from "@/contexts/Customer";
import WithdrawForm from "@/components/withdraw/WithdrawForm";

const { STRIPE_CONNECT_RETURN_URI } = Constants.expoConfig?.extra as {
  STRIPE_CONNECT_RETURN_URI: string;
};

/**
 * Withdraw screen (`/withdraw`) — Stripe Connect payout setup. Drives a 3-state
 * machine off `GET /cash-out/connect-status` ({ hasAccount, payoutsEnabledAt }):
 *
 *  - **No account** → the region gate. The onboarding copy names the payout
 *    country (`locale`); a mis-derived locale (e.g. a CZ user marked `US`) can be
 *    self-served US↔CZ via `updateLocale` *before* we ever create the Connect
 *    account, because Stripe locks the account's country at creation.
 *  - **Account, payouts not enabled** → "continue setup" (re-launch onboarding).
 *    The country is now locked, so a wrong country here is a support case.
 *  - **Payouts enabled** → ready (the withdrawal form lands in the next pass).
 *
 * Onboarding opens in an in-app auth session that returns to
 * `STRIPE_CONNECT_RETURN_URI` (`/customer/withdraw` → `tagly://withdraw`, this
 * screen); on return we re-sync status.
 */
export default function WithdrawScreen() {
  const { t } = useTranslation("withdraw");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { customer, reloadCustomer } = useCustomer();
  const { resetCache } = useBusinessMapCache();

  const [status, setStatus] = useState<GetConnectStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<null | "connect" | "switch">(null);
  const [supportOpen, setSupportOpen] = useState(false);
  // The pinned CTA bar overlays the scroll content; measure it so the content clears it.
  const [ctaBarHeight, setCtaBarHeight] = useState(0);

  const busy = action !== null;

  // Default reads the cheap DB value (kept fresh by the account.updated webhook);
  // `sync` forces a live Stripe reconcile — used on the post-onboarding return so
  // completion is caught immediately even if the webhook lags.
  const refetchStatus = useCallback(
    async (sync?: boolean) => {
      const res = await callAuthed(router, (jwt) =>
        getConnectStatus({ jwt, sync }),
      );
      if (res.ok && res.data) setStatus(res.data);
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refetchStatus();
      setLoading(false);
    })();
  }, [refetchStatus]);

  const locale = customer?.locale;
  const otherLocale: SupportedLocale = locale === "CZ" ? "US" : "CZ";

  // Launch Stripe Connect onboarding, then re-sync status on return (regardless
  // of whether the user finished or bailed — the browser resolves either way).
  const setUpPayouts = async () => {
    if (busy) return;
    setAction("connect");
    const res = await callAuthed(router, (jwt) =>
      startConnectOnboarding({ jwt }),
    );
    if (!res.ok || !res.data) {
      setAction(null);
      return;
    }
    try {
      await WebBrowser.openAuthSessionAsync(
        res.data.url,
        STRIPE_CONNECT_RETURN_URI,
      );
    } catch {
      // Swallow — we re-sync status below regardless of the browser outcome.
    }
    // Force a live Stripe reconcile on return so a just-completed onboarding shows
    // as enabled immediately (don't wait on the account.updated webhook).
    await refetchStatus(true);
    setAction(null);
  };

  // Self-serve region correction (US↔CZ). Valid only pre-onboarding; a 1721 means
  // a Connect account already exists (country locked) → route to support.
  const switchRegion = async () => {
    if (busy) return;
    setAction("switch");
    const res = await callAuthed(
      router,
      (jwt) => updateLocale({ jwt, body: { locale: otherLocale } }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      setAction(null);
      if (res.error?.error.code === 1721) setSupportOpen(true);
      return;
    }
    await reloadCustomer();
    // Business discovery is country-scoped server-side (every business endpoint
    // filters on `address.country_code = customer.locale`), so the map's cached
    // tiles/locals are now the wrong country — drop them.
    resetCache();
    setAction(null);
    showToast({ type: "success", text1: t("regionUpdatedToast") });
  };

  if (!customer || loading || !status) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={color.ink} />
        </View>
      </View>
    );
  }

  // Payouts enabled → the withdrawal form (the only state with a form body).
  if (status.payoutsEnabledAt) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <WithdrawForm balanceCents={customer.sensitiveData.balanceUsdCents} />
      </View>
    );
  }

  const country = t(`country.${locale}` as "country.US" | "country.CZ");
  const otherCountry = t(
    `country.${otherLocale}` as "country.US" | "country.CZ",
  );

  // Region switch is confirmed first: only flip the locale (and thus which country
  // Stripe creates the account in) after the user explicitly agrees.
  const promptSwitchRegion = () => {
    if (busy) return;
    customAlert(t("switchTitle"), t("switchBody", { country: otherCountry }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("switchConfirm"), onPress: switchRegion },
    ]);
  };

  // Creating the Connect account locks its country at Stripe, so confirm the
  // payout country before starting onboarding (gate state only — the continue
  // state's account already exists).
  const promptConnect = () => {
    if (busy) return;
    customAlert(t("connectTitle"), t("connectBody", { country }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("gateConfirm"), onPress: setUpPayouts },
    ]);
  };

  // Shared header: an accent circle + icon, then a title + body block. A plain
  // render function (not a component) so it isn't remounted on every render.
  const renderHeader = ({
    icon,
    title,
    body,
    tint,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
    tint: string;
  }) => (
    <View style={{ alignItems: "center", gap: spacing.lg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={32} color={color.ink} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text
          style={[
            text.title,
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
    </View>
  );

  // Per-state hero (icon + title + body) and the CTA buttons pinned at the bottom.
  let hero: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
    tint: string;
  };
  let ctaButtons: React.ReactNode = null;

  if (status.hasAccount) {
    // Account exists but payouts not enabled — country is locked; continue or support.
    hero = {
      icon: "hourglass-outline",
      title: t("continueTitle"),
      body: t("continueBody"),
      tint: color.accent,
    };
    ctaButtons = (
      <>
        <CustomButton
          type="primary"
          label={t("continueCta")}
          icon="arrow-forward"
          onPress={setUpPayouts}
          loading={action === "connect"}
          disabled={busy}
        />
        <CustomButton
          type="tertiary"
          label={t("contactSupport")}
          onPress={() => setSupportOpen(true)}
          disabled={busy}
        />
      </>
    );
  } else {
    // No account yet — the region gate (self-serve US↔CZ still possible).
    hero = {
      icon: "card-outline",
      title: t("gateTitle"),
      body: t("gateBody", { country }),
      tint: color.accent,
    };
    ctaButtons = (
      <>
        <CustomButton
          type="primary"
          label={t("gateConfirm")}
          icon="cash-outline"
          onPress={promptConnect}
          loading={action === "connect"}
          disabled={busy}
        />
        <CustomButton
          type="soft"
          label={t("gateSwitch", { country })}
          onPress={promptSwitchRegion}
          loading={action === "switch"}
          disabled={busy}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />

      {/* Hero scrolls (and centers when short); the CTAs are pinned below,
          overflowing the scroll content — the bar carries the top shadow, the
          buttons inside stay flat. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.xl,
          paddingBottom:
            (ctaButtons ? ctaBarHeight : insets.bottom) + spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader(hero)}
      </ScrollView>

      {ctaButtons && (
        <BottomActionBar onHeightChange={setCtaBarHeight}>
          {ctaButtons}
        </BottomActionBar>
      )}

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="withdraw-region"
      />
    </View>
  );
}
