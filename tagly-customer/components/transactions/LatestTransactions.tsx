import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { callAuthed, SectionHeader, useTheme, withAlpha } from "@tagly/client";
import { getCustomerTransactions } from "@tagly/sdk/v2/customerApp";
import type { CustomerTransaction } from "@tagly/models/v2/customerApp";
import TransactionPreview from "./TransactionPreview";

const LIMIT = 4;

/**
 * Account "Recent transactions" section — the latest few money movements
 * (earnings + withdrawals), with "See all" → the full /transactions screen. Loads
 * its own slice via `POST /v2/customers/transactions`. Each row is the shared
 * expandable `TransactionPreview` card; a share reward taps through to /shares.
 */
export default function LatestTransactions() {
  const { t } = useTranslation("account");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;

  const [transactions, setTransactions] = useState<
    CustomerTransaction[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await callAuthed(
        router,
        (jwt) =>
          getCustomerTransactions({ jwt, body: { offset: 0, limit: LIMIT } }),
        { suppressAlerts: true },
      );
      if (!cancelled && result.ok && result.data)
        setTransactions(result.data.transactions);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasTransactions = transactions !== null && transactions.length > 0;

  return (
    <View style={{ gap: spacing.sm, marginHorizontal: layout.screenPadding }}>
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
        // Brand-new account: a calm inline card (green cash chip + title + hint)
        // rather than a bare centered line, so an empty feed reads as "waiting"
        // not broken. Copy matches the full /transactions empty state.
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
  );
}
