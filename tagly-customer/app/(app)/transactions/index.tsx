import { useEffect, useState } from "react";
import { InteractionManager, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BottomSheet,
  consumePendingStoreReview,
  CustomButton,
  makeOffsetFetcher,
  PaginatedList,
  pressFeedbackStyle,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { getCustomerTransactions } from "@tagly/sdk/v2/customerApp";
import type {
  CustomerTransaction,
  CustomerTransactionTypeFilter,
  GetCustomerTransactionsBody,
} from "@tagly/models/v2/customerApp";
import TransactionPreview from "@/components/transactions/TransactionPreview";

const PAGE_LIMIT = 20;

/**
 * Transactions screen — the customer's money history (earnings in + withdrawals
 * out), reached from the Account hub. Paginated via `PaginatedList` +
 * `getCustomerTransactions`, with a type filter (draft + Done bottom sheet, like
 * the browse-businesses category filter) and a "Your money" explainer.
 */
export default function TransactionsScreen() {
  const { t } = useTranslation("transactions");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;

  const [filterOpen, setFilterOpen] = useState(false);

  // A just-started withdrawal routes here, so consume any queued store-review
  // prompt now that we're on a stable screen (self-throttled, no-op when nothing's
  // queued). Deferred past the navigation transition.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void consumePendingStoreReview();
    });
    return () => task.cancel();
  }, []);
  // Applied filter drives the query (→ refetch); the draft only commits on Done.
  const [selected, setSelected] = useState<CustomerTransactionTypeFilter[]>([]);
  const [draft, setDraft] = useState<CustomerTransactionTypeFilter[]>([]);

  const query: Omit<GetCustomerTransactionsBody, "offset"> = {
    limit: PAGE_LIMIT,
    types: selected.length > 0 ? selected : undefined,
  };

  const TYPES: { key: CustomerTransactionTypeFilter; label: string }[] = [
    { key: "SHARE_PAYMENT", label: t("typeShare") },
    { key: "REFERRAL_PAYOUT", label: t("typeReferral") },
    { key: "ADJUSTMENT", label: t("typeAdjustment") },
    { key: "WITHDRAWAL", label: t("typeWithdrawal") },
  ];

  const openFilter = () => {
    setDraft(selected);
    setFilterOpen(true);
  };
  const toggleDraft = (key: CustomerTransactionTypeFilter) =>
    setDraft((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  const applyFilter = () => {
    setSelected(draft);
    setFilterOpen(false);
  };

  const Pill = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          backgroundColor: active ? color.ink : color.surface,
          borderRadius: radius.pill,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          boxShadow: active ? undefined : shadow.chip,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Text
        selectable={false}
        style={[
          text.label,
          { color: active ? color.on.ink : color.text.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  // Header: the type-filter trigger.
  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
      <Pressable
        onPress={openFilter}
        hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            alignSelf: "flex-start",
            backgroundColor: selected.length > 0 ? color.ink : color.surface,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            boxShadow: selected.length > 0 ? undefined : shadow.chip,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={selected.length > 0 ? color.on.ink : color.text.primary}
        />
        <Text
          style={[
            text.label,
            { color: selected.length > 0 ? color.on.ink : color.text.primary },
          ]}
        >
          {selected.length > 0
            ? t("filterSelected", { count: selected.length })
            : t("filterAll")}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={selected.length > 0 ? color.on.ink : color.text.tertiary}
        />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      <PaginatedList<CustomerTransaction, GetCustomerTransactionsBody>
        router={router}
        query={query}
        fetchPage={makeOffsetFetcher(
          getCustomerTransactions,
          (r) => r.transactions,
        )}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={header}
        emptyHeading={t("empty")}
        emptySubheading={t("emptyHint")}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <TransactionPreview item={item} />
          </View>
        )}
      />

      {/* Type filter — multi-select draft; applies (refetches) on Done. */}
      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("filterTitle")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginTop: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          {TYPES.map((ty) => (
            <Pill
              key={ty.key}
              label={ty.label}
              active={draft.includes(ty.key)}
              onPress={() => toggleDraft(ty.key)}
            />
          ))}
        </View>
        <CustomButton
          type="primary"
          label={t("filterDone")}
          onPress={applyFilter}
        />
      </BottomSheet>
    </View>
  );
}
