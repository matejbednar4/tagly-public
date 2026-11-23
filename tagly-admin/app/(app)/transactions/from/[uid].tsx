import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  useRouter,
  useLocalSearchParams,
  type Router,
} from "expo-router";
import { useTheme, callAuthed, PaginatedList, TopMenu } from "@tagly/client";
import { adminGetLedgerEventsFromUid } from "@tagly/sdk/v2/adminApp";
import type {
  AdminLedgerEvent,
  AdminLedgerSort,
} from "@tagly/models/v2/adminApp";
import { SortControl } from "@/components/entities/SortControl";
import { LedgerEventCard } from "@/components/details/DetailKit";

type LedgerQuery = { uid: string; sort: AdminLedgerSort; offset: number };

const SORTS: { label: string; value: AdminLedgerSort }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
];

/**
 * Transactions from one entity — `GET /v2/admin/ledger-events/from/:uid`
 * (customer / advertiser / business, resolved by uid prefix; a business shows
 * its advertiser's trail). Paginated, newest first. This is the entity-wide
 * chronological money feed — broader than the per-purchase / per-withdrawal
 * trails embedded in the detail screens. Reached from the "View all
 * transactions" link on each entity detail screen; `?title=<name>` carries the
 * entity's name into the header. Each event's share link taps to the share
 * detail.
 */
export default function AdminTransactionsFromScreen() {
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const router = useRouter();
  const { uid, title } = useLocalSearchParams<{ uid: string; title?: string }>();

  const [sort, setSort] = useState<AdminLedgerSort>("newest");

  const fetchPage = useCallback(
    async ({ query, router: r }: { query: LedgerQuery; router: Router }) => {
      const res = await callAuthed(
        r,
        (jwt) =>
          adminGetLedgerEventsFromUid({
            jwt,
            params: { uid: query.uid },
            query: { sort: query.sort, page: query.offset + 1 },
          }),
        { suppressAlerts: true },
      );
      if (res.ok && res.data) {
        return {
          items: res.data.events,
          offset: query.offset,
          hasMore: res.data.hasMore,
        };
      }
      return { items: [], offset: query.offset, hasMore: false };
    },
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={title ? `Transactions · ${title}` : "Transactions"}
        showBack
        hideMenu
      />

      <View
        style={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
          marginBottom: spacing.md,
        }}
      >
        <SortControl value={sort} options={SORTS} onChange={setSort} />
      </View>

      <View style={{ flex: 1 }}>
        <PaginatedList<AdminLedgerEvent, LedgerQuery>
          key={sort}
          router={router}
          query={{ uid: uid as string, sort }}
          fetchPage={fetchPage}
          keyExtractor={(item, index) =>
            `${item.kind}-${item.createdAt}-${index}`
          }
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.md }}>
              <LedgerEventCard
                event={item}
                onPressShare={(shareUid) => router.push(`/shares/${shareUid}`)}
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding }}
          emptyHeading="No transactions"
          emptySubheading="This account has no ledger events yet."
        />
      </View>
    </View>
  );
}
