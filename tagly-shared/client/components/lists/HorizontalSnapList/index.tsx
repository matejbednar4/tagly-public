import { useRef } from "react";
import type { ReactElement } from "react";
import { FlatList, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { spacing as spacingTokens, layout as layoutTokens } from "../../../theme/theme";

/**
 * HorizontalSnapList — the app's standard horizontal "shelf": a snap-scrolling
 * FlatList where each card snaps to the screen's left inset, so a flick settles
 * on the next card (the same feel as the Discover shelves and the map carousel).
 *
 * It owns only the scroll mechanics, so it stays reusable across entities: the
 * caller supplies fixed-width cards (`cardWidth`) + how to render one, and the
 * surrounding section header / loading / empty states. The list bleeds full
 * width while `contentInset` aligns the first and last card to the screen edge,
 * so cards scroll fully off both sides.
 *
 * Re-tapping the active tab slides the list back to the start (registered via
 * `useScrollToTop`), matching every other scrollable surface on a tab screen.
 */
export function HorizontalSnapList<T>({
  data,
  renderItem,
  keyExtractor,
  cardWidth,
  gap = spacingTokens.md,
  contentInset = layoutTokens.screenPadding,
  paddingTop = spacingTokens.xs,
  paddingBottom = spacingTokens.lg,
}: {
  data: T[];
  renderItem: (item: T, index: number) => ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  /** Fixed width of each card; the snap interval is this + `gap`. */
  cardWidth: number;
  /** Gap between cards (also the exact snap separator). Defaults to spacing.md. */
  gap?: number;
  /** Start/end inset that aligns the first/last card to the screen edge. Defaults to layout.screenPadding. */
  contentInset?: number;
  /** Gap above the cards (also the header→cards gap). Small by default. */
  paddingTop?: number;
  /** Room below the cards — `shadow.card` casts ~16px down, so this must clear
   *  it or the shadow gets clipped by the (content-height) list frame. */
  paddingBottom?: number;
}) {
  // Registered so re-tapping the active tab slides the shelf back to the start
  // (alongside the page scrolling to top). Must be unconditional (Rules of Hooks).
  const listRef = useRef<FlatList<T>>(null);
  useScrollToTop(listRef);

  return (
    <FlatList
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={keyExtractor}
      // Item-by-item snap (like the map carousel): each card snaps to the left
      // inset. ItemSeparatorComponent (not `gap`) so the snap interval — card +
      // separator — stays exact.
      snapToInterval={cardWidth + gap}
      snapToAlignment="start"
      decelerationRate="fast"
      ItemSeparatorComponent={() => <View style={{ width: gap }} />}
      contentContainerStyle={{
        paddingHorizontal: contentInset,
        paddingTop,
        paddingBottom,
      }}
      renderItem={({ item, index }) => renderItem(item, index)}
    />
  );
}
