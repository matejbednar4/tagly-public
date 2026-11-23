import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeProvider";

/**
 * GeneralVerticalList — the one vertical list primitive. A themed `FlatList`
 * wrapper that owns the shared chrome: loading footer (initial + load-more
 * spinner), empty state, "end reached" text, optional pull-to-refresh, 1/2
 * columns, and the screen-edge padding convention (top = `layout.screenPadding`,
 * bottom = `insets.bottom + layout.screenPadding`, both overridable).
 *
 * Presentational only — it doesn't fetch. For paginated data, use `PaginatedList`
 * (which drives this off `usePagedList`); for static/local lists, use it directly.
 * Default empty/end copy comes from the `generalList` namespace; pass
 * `emptyHeading`/`endText` to override per screen.
 */
export type GeneralVerticalListProps<T> = {
  data: T[];
  renderItem: ListRenderItem<T>;
  /** Defaults to item.uid → item.id → index. */
  keyExtractor?: (item: T, index: number) => string;

  loading?: boolean;
  hasMore?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;

  /** Pull-to-refresh — both must be set to enable it. */
  onRefresh?: () => void;
  refreshing?: boolean;

  numColumns?: 1 | 2;
  ListHeaderComponent?: React.ReactElement | null;

  emptyHeading?: string;
  emptySubheading?: string;
  endText?: string;
  /** Show the "end reached" text when there's nothing more. Default true. */
  showEndText?: boolean;

  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Override the default top inset (`layout.screenPadding`). */
  paddingTop?: number;
  /** Override the default bottom inset (`insets.bottom + layout.screenPadding`). */
  paddingBottom?: number;
};

function defaultKeyExtractor(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const o = item as { uid?: unknown; id?: unknown };
    if (typeof o.uid === "string") return o.uid;
    if (o.id != null) return String(o.id);
  }
  return String(index);
}

function GeneralVerticalListInner<T>(
  props: GeneralVerticalListProps<T>,
  ref: React.Ref<FlatList<T>>,
) {
  const {
    data,
    renderItem,
    keyExtractor,
    loading = false,
    hasMore = false,
    onEndReached,
    onEndReachedThreshold = 0.5,
    onRefresh,
    refreshing,
    numColumns = 1,
    ListHeaderComponent,
    emptyHeading,
    emptySubheading,
    endText,
    showEndText = true,
    showsVerticalScrollIndicator = false,
    contentContainerStyle,
    paddingTop,
    paddingBottom,
  } = props;

  const { t } = useTranslation("generalList");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList<T>>(null);
  useImperativeHandle(ref, () => listRef.current as FlatList<T>);

  const topPad = paddingTop ?? layout.screenPadding;
  const bottomPad = paddingBottom ?? insets.bottom + layout.screenPadding;

  // Footer: load-more spinner while fetching, else the end note once exhausted.
  const footer = (
    <View style={{ marginTop: data.length > 0 ? spacing.lg : 0 }}>
      {loading && data.length > 0 ? (
        <ActivityIndicator color={color.text.tertiary} />
      ) : !hasMore && data.length > 0 && showEndText ? (
        <Text
          style={[
            text.caption,
            { color: color.text.tertiary, textAlign: "center" },
          ]}
        >
          {endText ?? t("endReached")}
        </Text>
      ) : null}
    </View>
  );

  // Empty: only once the first load has settled (not while still loading).
  const empty =
    loading ? null : (
      <View style={{ gap: spacing.xs, paddingVertical: spacing["2xl"] }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {emptyHeading ?? t("empty")}
        </Text>
        {emptySubheading ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {emptySubheading}
          </Text>
        ) : null}
      </View>
    );

  return (
    <FlatList
      ref={listRef}
      // numColumns can't change at runtime without a remount.
      key={`cols-${numColumns}`}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor ?? defaultKeyExtractor}
      numColumns={numColumns}
      columnWrapperStyle={
        numColumns === 2 ? { justifyContent: "space-between" } : undefined
      }
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      onEndReached={() => {
        if (loading || !onEndReached) return;
        onEndReached();
      }}
      onEndReachedThreshold={onEndReachedThreshold}
      onRefresh={onRefresh && refreshing !== undefined ? onRefresh : undefined}
      refreshing={onRefresh && refreshing !== undefined ? refreshing : undefined}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingHorizontal: layout.screenPadding,
          paddingTop: topPad,
          paddingBottom: bottomPad,
          flexGrow: 1,
        },
        contentContainerStyle,
      ]}
    />
  );
}

export const GeneralVerticalList = forwardRef(GeneralVerticalListInner) as <T>(
  props: GeneralVerticalListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement;
