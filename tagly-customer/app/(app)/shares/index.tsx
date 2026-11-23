import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BottomSheet,
  CustomButton,
  makeOffsetFetcher,
  PaginatedList,
  pressFeedbackStyle,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { getMyShares } from "@tagly/sdk/v2/customerApp";
import type {
  CustomerSharePreview,
  GetMySharesBody,
  ShareListSort,
} from "@tagly/models/v2/customerApp";
import SharePreviewCard from "@/components/shares/SharePreviewCard";

const NUM_COLUMNS = 2;
const PAGE_LIMIT = 12;

/**
 * Shares screen — the customer's full, paginated grid of their own shares,
 * reached from the Account hub's "Your shares" strip. Two-column grid of
 * `SharePreviewCard`, sortable (newest / oldest / highest / lowest reward).
 *
 * Mirrors the browse-all-businesses screen: the screen owns only its sort UI (a
 * trigger that opens a bottom sheet of options, like that screen's category
 * filter); the shared `PaginatedList` handles fetch/append/loading/empty/end +
 * refetch when the `query` (sort) changes, via
 * `makeOffsetFetcher(getMyShares, r => r.shares)`.
 *
 * Each `SharePreviewCard` owns its own press → `/shares/[uid]` navigation.
 */
export default function SharesScreen() {
  const { t } = useTranslation("shares");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const { width } = useWindowDimensions();

  // `sortBy` is the APPLIED sort (drives the query → a refetch). `draftSort` is
  // the in-sheet selection that only commits on Done — so picking an option
  // doesn't refetch until the user confirms (mirrors the category filter).
  const [sortBy, setSortBy] = useState<ShareListSort>("newest");
  const [draftSort, setDraftSort] = useState<ShareListSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  // Sort flips inline (one tap = one refetch); PaginatedList watches `query`.
  const query: Omit<GetMySharesBody, "offset"> = {
    limit: PAGE_LIMIT,
    sortBy,
  };

  // 2-col grid: each card sized so the list's space-between leaves exactly one
  // `spacing.md` gutter between the columns.
  const cardWidth = Math.floor(
    (width - layout.screenPadding * 2 - spacing.md) / NUM_COLUMNS,
  );

  const SORTS: { key: ShareListSort; label: string }[] = [
    { key: "newest", label: t("sortNewest") },
    { key: "oldest", label: t("sortOldest") },
    { key: "highest_reward", label: t("sortHighest") },
    { key: "lowest_reward", label: t("sortLowest") },
  ];
  const activeSortLabel =
    SORTS.find((s) => s.key === sortBy)?.label ?? t("sortNewest");

  // Open with the draft synced to the applied sort; picking only updates the
  // draft; Done commits it (→ query change → refetch). Dismissing without Done
  // discards the draft (no refetch) — it re-syncs on the next open.
  const openSort = () => {
    setDraftSort(sortBy);
    setSortOpen(true);
  };
  const applySort = () => {
    setSortBy(draftSort);
    setSortOpen(false);
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

  // Sort trigger (icon + current value + chevron) — opens the sheet; the same
  // shape as browse-businesses' category filter trigger.
  const header = (
    <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
      <Text style={[text.bodyMedium, { color: color.text.primary }]}>
        {t("sortBy")}
      </Text>
      <Pressable
        onPress={openSort}
        hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            alignSelf: "flex-start",
            backgroundColor: color.surface,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            boxShadow: shadow.chip,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <Ionicons name="swap-vertical" size={16} color={color.text.primary} />
        <Text style={[text.label, { color: color.text.primary }]}>
          {activeSortLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={color.text.tertiary} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      <PaginatedList<CustomerSharePreview, GetMySharesBody>
        router={router}
        query={query}
        fetchPage={makeOffsetFetcher(getMyShares, (r) => r.shares)}
        numColumns={NUM_COLUMNS}
        keyExtractor={(s) => s.uid}
        ListHeaderComponent={header}
        emptyHeading={t("empty")}
        emptySubheading={t("emptyHint")}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <SharePreviewCard share={item} width={cardWidth} />
          </View>
        )}
      />

      {/* Sort sheet — single-select draft; the list only refetches when Done is
          tapped (dismissing discards the draft). */}
      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("sortBy")}
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
          {SORTS.map((s) => (
            <Pill
              key={s.key}
              label={s.label}
              active={draftSort === s.key}
              onPress={() => setDraftSort(s.key)}
            />
          ))}
        </View>
        <CustomButton type="primary" label={t("done")} onPress={applySort} />
      </BottomSheet>
    </View>
  );
}
