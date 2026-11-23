import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import {
  useTheme,
  TopMenu,
  ZoomOnFocus,
  SectionHeader,
  callAuthed,
  useNavBottomPadding,
  withAlpha,
} from "@tagly/client";
import { getAdvertiserTransactions } from "@tagly/sdk/v2/advertiserApp";
import type { AdvertiserTransaction } from "@tagly/models/v2/advertiserApp";
import { FundingSurface } from "@/components/billing/FundingSurface";
import { VisibilityCard } from "@/components/billing/VisibilityCard";
import TransactionPreview from "@/components/billing/TransactionPreview";

const LATEST_LIMIT = 4;

/**
 * Wallet tab — the money hub, under the shared `TopMenu`. Top to bottom:
 *   1. VisibilityCard — the not-visible strip (renders nothing while visible).
 *   2. FundingSurface — the whole funding body: the balance card and the
 *      "How you pay" rows (or, on a never-funded account, the prepay
 *      vs pay-per-share pitch). It owns every billing sheet itself, so this
 *      screen wires none of them — the same body the onboarding payment step
 *      mounts, which is what keeps the two screens identical.
 *   3. Transactions — the latest few rows of the unified money feed, "See all"
 *      → the pushed /transactions screen.
 *
 * Balances ride on `AdvertiserMe` (context); the feed slice is fetched
 * screen-locally on mount and re-pulled after any money action.
 */
export default function WalletScreen() {
  const { t } = useTranslation("wallet");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const bottomPad = useNavBottomPadding();

  const [transactions, setTransactions] = useState<
    AdvertiserTransaction[] | null
  >(null);

  // Pressing the active tab scrolls this screen back to the top (shared
  // BottomNavigation emits `tabPress`) — matches tagly-customer.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const loadTransactions = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const res = await callAuthed(
        router,
        (jwt) =>
          getAdvertiserTransactions({
            jwt,
            body: { offset: 0, limit: LATEST_LIMIT },
          }),
        { suppressAlerts: silent },
      );
      if (res.ok && res.data) setTransactions(res.data.transactions);
    },
    [router],
  );

  useEffect(() => {
    void loadTransactions({ silent: true });
  }, [loadTransactions]);

  // Only the feed is this screen's to refresh: every billing sheet re-pulls
  // /me and the shared queries itself before handing back (`useConfirmedExit`),
  // so balances are already current here.
  const onMoneyChanged = useCallback(() => {
    void loadTransactions({ silent: true });
  }, [loadTransactions]);

  const hasTransactions = transactions !== null && transactions.length > 0;

  return (
    <ZoomOnFocus>
      <TopMenu title={t("title")} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: layout.screenPadding,
          paddingHorizontal: layout.screenPadding,
          paddingBottom: bottomPad,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <VisibilityCard />

        <FundingSurface
          surface="wallet"
          onFunded={onMoneyChanged}
          onChanged={onMoneyChanged}
        />

        {/* Transactions — the latest slice of the unified money feed. */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title={t("transactionsTitle")}
            onSeeAll={
              hasTransactions ? () => router.push("/transactions") : undefined
            }
          />
          {transactions === null ? (
            <View style={{ paddingVertical: spacing.xl }}>
              <ActivityIndicator color={color.text.tertiary} />
            </View>
          ) : transactions.length === 0 ? (
            // Brand-new account: a calm inline card so an empty feed reads as
            // "waiting", not broken (mirrors the customer account hub).
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.card,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(color.success, 0.14),
                }}
              >
                <Ionicons name="cash-outline" size={20} color={color.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                  {t("noTransactions")}
                </Text>
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("noTransactionsHint")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {transactions.map((item) => (
                <TransactionPreview key={item.key} item={item} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ZoomOnFocus>
  );
}
