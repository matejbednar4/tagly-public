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
import { getMyShares } from "@tagly/sdk/v2/advertiserApp";
import type {
  AdvertiserSharePreview,
  GetAdvertiserSharesBody,
  AdvertiserShareListSort,
} from "@tagly/models/v2/advertiserApp";
import { SharePreviewCard } from "@/components/shares/SharePreviewCard";

const NUM_COLUMNS = 2;
const PAGE_LIMIT = 12;

/**
 * Shares screen — the advertiser's full, paginated grid of their shares (across
 * all businesses), reached from the home "recent shares" strip. Mirrors the
 * customer shares screen: a sort trigger → bottom sheet, and the shared
 * `PaginatedList` owns fetch/append/empty/refetch-on-sort via
 * `makeOffsetFetcher(getMyShares, r => r.shares)`. Each card taps through to the
 * share detail (where it can be rated/reported).
 */
export default function SharesScreen() {
  const { t } = useTranslation("advertiserShares");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const { width } = useWindowDimensions();

  const [sortBy, setSortBy] = useState<AdvertiserShareListSort>("newest");
  const [draftSort, setDraftSort] = useState<AdvertiserShareListSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const query: Omit<GetAdvertiserSharesBody, "offset"> = {
    limit: PAGE_LIMIT,
    sortBy,
  };

  const cardWidth = Math.floor(
    (width - layout.screenPadding * 2 - spacing.md) / NUM_COLUMNS
  );

  const SORTS: { key: AdvertiserShareListSort; label: string }[] = [
    { key: "newest", label: t("sortNewest") },
    { key: "oldest", label: t("sortOldest") },
    { key: "highest_price", label: t("sortHighest") },
    { key: "lowest_price", label: t("sortLowest") },
  ];
  const activeSortLabel =
    SORTS.find((s) => s.key === sortBy)?.label ?? t("sortNewest");

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
        style={[text.label, { color: active ? color.on.ink : color.text.primary }]}
      >
        {label}
      </Text>
    </Pressable>
  );

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
      <PaginatedList<AdvertiserSharePreview, GetAdvertiserSharesBody>
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
            <SharePreviewCard
              share={item}
              width={cardWidth}
              onPress={() => router.push(`/shares/${item.uid}`)}
            />
          </View>
        )}
      />

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
