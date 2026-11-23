import { useCallback, useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter, type Router } from "expo-router";
import { useTheme, callAuthed, PaginatedList, TopMenu } from "@tagly/client";
import { adminListEntities } from "@tagly/sdk/v2/adminApp";
import type {
  AdminListEntityType,
  AdminListSort,
  AdminCustomer,
  AdminAdvertiser,
  AdminBusiness,
  AdminShare,
} from "@tagly/models/v2/adminApp";
import { EntityChip } from "@/components/entities/EntityChip";
import { SortControl } from "@/components/entities/SortControl";
import {
  CustomerRow,
  AdvertiserRow,
  BusinessRow,
  ShareRow,
} from "@/components/entities/EntityRows";

type EntityItem = AdminCustomer | AdminAdvertiser | AdminBusiness | AdminShare;
type EntitiesQuery = {
  type: AdminListEntityType;
  sort: AdminListSort;
  offset: number;
  limit?: number;
};

const TYPES: { label: string; value: AdminListEntityType }[] = [
  { label: "Customers", value: "customer" },
  { label: "Advertisers", value: "advertiser" },
  { label: "Businesses", value: "local" },
  { label: "Shares", value: "share" },
];

const SORTS: { label: string; value: AdminListSort; nameSort: boolean }[] = [
  { label: "Newest first", value: "newest", nameSort: false },
  { label: "Oldest first", value: "oldest", nameSort: false },
  { label: "Name A→Z", value: "name_asc", nameSort: true },
  { label: "Name Z→A", value: "name_desc", nameSort: true },
];

function renderRow(type: AdminListEntityType, item: EntityItem, router: Router) {
  switch (type) {
    case "customer":
      return (
        <CustomerRow
          item={item as AdminCustomer}
          onPress={() => router.push(`/customers/${item.uid}`)}
        />
      );
    case "advertiser":
      return (
        <AdvertiserRow
          item={item as AdminAdvertiser}
          onPress={() => router.push(`/advertisers/${item.uid}`)}
        />
      );
    case "local":
      return (
        <BusinessRow
          item={item as AdminBusiness}
          onPress={() => router.push(`/businesses/${item.uid}`)}
        />
      );
    case "share":
      return (
        <ShareRow
          item={item as AdminShare}
          onPress={() => router.push(`/shares/${item.uid}`)}
        />
      );
  }
}

/**
 * List — browse one entity type at a time (`GET /v2/admin/entities`), paginated.
 * Type is a single-line chip row; sort lives in a bottom sheet. The list is
 * keyed by `type` so it fully remounts on a type switch — this both resets scroll
 * and, critically, prevents rendering the previous type's rows against the new
 * type (which would crash on the mismatched shape).
 */
export default function EntitiesListScreen() {
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const router = useRouter();

  const [type, setType] = useState<AdminListEntityType>("customer");
  const [sort, setSort] = useState<AdminListSort>("newest");

  const onSelectType = useCallback((next: AdminListEntityType) => {
    setType(next);
    // Name sorts don't apply to shares — fall back to newest.
    if (next === "share") setSort((s) => (s.startsWith("name") ? "newest" : s));
  }, []);

  const fetchPage = useCallback(
    async ({ query, router: r }: { query: EntitiesQuery; router: Router }) => {
      const res = await callAuthed(
        r,
        (jwt) =>
          adminListEntities({
            jwt,
            query: {
              type: query.type,
              sort: query.sort,
              page: query.offset + 1, // usePagedList counts "offset" as a 0-based page
            },
          }),
        { suppressAlerts: true },
      );
      if (res.ok && res.data) {
        const d = res.data;
        const items: EntityItem[] =
          query.type === "customer"
            ? d.customers
            : query.type === "advertiser"
              ? d.advertisers
              : query.type === "local"
                ? d.locals
                : d.shares;
        return { items, offset: query.offset, hasMore: d.hasMore };
      }
      return { items: [], offset: query.offset, hasMore: false };
    },
    [],
  );

  const availableSorts = SORTS.filter((s) => type !== "share" || !s.nameSort).map(
    (s) => ({ label: s.label, value: s.value }),
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="List" showBack hideMenu />

      {/* Type — one horizontal line, never wraps. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: layout.screenPadding,
          // Screen-top gap below the bar; xs bottom room so the chips' shadows
          // aren't clipped by the scroll frame.
          paddingTop: layout.screenPadding,
          paddingBottom: spacing.xs,
        }}
      >
        {TYPES.map((t) => (
          <EntityChip
            key={t.value}
            label={t.label}
            active={type === t.value}
            onPress={() => onSelectType(t.value)}
          />
        ))}
      </ScrollView>

      {/* Sort — opens a sheet. */}
      <View
        style={{
          paddingHorizontal: layout.screenPadding,
          marginTop: spacing.md,
          marginBottom: spacing.md,
        }}
      >
        <SortControl value={sort} options={availableSorts} onChange={setSort} />
      </View>

      <View style={{ flex: 1 }}>
        <PaginatedList<EntityItem, EntitiesQuery>
          key={type}
          router={router}
          query={{ type, sort }}
          fetchPage={fetchPage}
          keyExtractor={(item) => item.uid}
          // Businesses show as a 2-up grid of vertical banner cards; everything
          // else is a full-width horizontal row.
          numColumns={type === "local" ? 2 : 1}
          renderItem={({ item }) => (
            <View
              style={{
                marginBottom: spacing.md,
                width: type === "local" ? "48%" : undefined,
              }}
            >
              {renderRow(type, item, router)}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding }}
          emptyHeading="Nothing here yet"
          emptySubheading="No records of this type."
        />
      </View>
    </View>
  );
}
