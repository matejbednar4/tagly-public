import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  useRouter,
  useLocalSearchParams,
  type Router,
} from "expo-router";
import { useTheme, callAuthed, PaginatedList, TopMenu } from "@tagly/client";
import { adminGetSharesFromUid } from "@tagly/sdk/v2/adminApp";
import type { AdminShare, AdminSharesSort } from "@tagly/models/v2/adminApp";
import { SortControl } from "@/components/entities/SortControl";
import { ShareRow } from "@/components/entities/EntityRows";

type SharesQuery = { uid: string; sort: AdminSharesSort; offset: number };

const SORTS: { label: string; value: AdminSharesSort }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Highest reward", value: "highest_reward" },
  { label: "Lowest reward", value: "lowest_reward" },
];

/**
 * Shares from one entity — `GET /v2/admin/shares/from/:uid` (customer /
 * advertiser / business, resolved by uid prefix), paginated, newest first.
 * Reached from the "View all shares" button on each entity detail screen; the
 * `title` param carries the entity's name so the header reads whose shares
 * these are. Each row taps through to the share detail.
 */
export default function AdminSharesFromScreen() {
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const router = useRouter();
  const { uid, title } = useLocalSearchParams<{ uid: string; title?: string }>();

  const [sort, setSort] = useState<AdminSharesSort>("newest");

  const fetchPage = useCallback(
    async ({ query, router: r }: { query: SharesQuery; router: Router }) => {
      const res = await callAuthed(
        r,
        (jwt) =>
          adminGetSharesFromUid({
            jwt,
            params: { uid: query.uid },
            query: { sort: query.sort, page: query.offset + 1 },
          }),
        { suppressAlerts: true },
      );
      if (res.ok && res.data) {
        return {
          items: res.data.shares,
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
      <TopMenu title={title ? `Shares · ${title}` : "Shares"} showBack hideMenu />

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
        <PaginatedList<AdminShare, SharesQuery>
          key={sort}
          router={router}
          query={{ uid: uid as string, sort }}
          fetchPage={fetchPage}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.md }}>
              <ShareRow
                item={item}
                onPress={() => router.push(`/shares/${item.uid}`)}
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding }}
          emptyHeading="No shares"
          emptySubheading="This account has no shares yet."
        />
      </View>
    </View>
  );
}
