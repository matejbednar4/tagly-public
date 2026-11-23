import React, { useEffect, useRef } from "react";
import type { ListRenderItem, StyleProp, ViewStyle } from "react-native";
import type { Router } from "expo-router";
import { usePagedList, type FetchPage } from "../../../hooks/usePagedList";
import { GeneralVerticalList } from "../GeneralVerticalList";

/**
 * PaginatedList — the one component for any offset-paginated list. Marries
 * `usePagedList` (fetch/append/loadNext) with `GeneralVerticalList` (the UI), so
 * a screen supplies only three things: the **fetch** (`fetchPage`, usually
 * `makeOffsetFetcher(sdkFn, selectItems)`), the **filter/sort state** (`query` —
 * everything except `offset`), and how to **render one item** (`renderItem`,
 * i.e. the entity's preview). Loading, empty, end-of-list, infinite scroll, and
 * refetch-on-filter-change are all handled here.
 *
 * The generic `T` is the entity type; `query` carries the per-endpoint sort +
 * filters. Changing `query` (the screen flipping a sort/filter) resets the list
 * to page 0 and refetches.
 */
export type PaginatedListProps<
  T,
  Q extends { offset: number; limit?: number },
> = {
  router: Router;
  /** Filter/sort state (everything but `offset`). Changing it refetches page 0. */
  query: Omit<Q, "offset">;
  fetchPage: FetchPage<T, Q>;
  renderItem: ListRenderItem<T>;

  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: React.ReactElement | null;
  numColumns?: 1 | 2;

  emptyHeading?: string;
  emptySubheading?: string;
  endText?: string;

  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Override the list's bottom inset (e.g. a tab screen passes useNavBottomPadding()). */
  paddingBottom?: number;
};

export function PaginatedList<T, Q extends { offset: number; limit?: number }>({
  router,
  query,
  fetchPage,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  numColumns,
  emptyHeading,
  emptySubheading,
  endText,
  contentContainerStyle,
  paddingBottom,
}: PaginatedListProps<T, Q>) {
  const { items, loading, hasMore, loadNext, setQuery } = usePagedList<T, Q>(
    router,
    query,
    fetchPage,
  );

  // Refetch from page 0 whenever the filter/sort state changes. Skip the first
  // run — usePagedList already initialised with `query`.
  const queryKey = JSON.stringify(query);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setQuery(query as Partial<Omit<Q, "offset">>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return (
    <GeneralVerticalList<T>
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      loading={loading}
      hasMore={hasMore}
      onEndReached={loadNext}
      numColumns={numColumns}
      ListHeaderComponent={ListHeaderComponent}
      emptyHeading={emptyHeading}
      emptySubheading={emptySubheading}
      endText={endText}
      contentContainerStyle={contentContainerStyle}
      paddingBottom={paddingBottom}
    />
  );
}
