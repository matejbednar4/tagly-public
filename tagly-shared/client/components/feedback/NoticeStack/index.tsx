import { ReactNode, useState } from "react";
import {
  View,
  ScrollView,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from "react-native";
import { spacing, layout } from "../../../theme/theme";

/** Gap of cream between paged cards. */
const GAP = spacing.md;
/** How much of the next card stays on screen, so it's clear another one exists. */
const PEEK = spacing["2xl"];
/**
 * Room for the card's shadow inside the (clipping) ScrollView, cancelled by an
 * equal negative margin — so the pager takes no more space than a lone card and
 * the shadow isn't clipped.
 */
const SHADOW_PAD = spacing.md;

/**
 * NoticeStack — shows floating notices (location denied, rewards calculating, …)
 * as a horizontal pager you swipe between: the active card is near full width, the
 * next peeks in from the right so it's clear more exist. A single notice renders
 * plainly. Notices are passed in priority order (index 0 shows first) as plain
 * nodes; the caller positions the whole thing (map top overlay / top of the
 * Discover feed) and must NOT inset it horizontally — the screen padding is
 * applied internally so cards read as full-width.
 */
export function NoticeStack({
  notices,
  style,
}: {
  notices: ReactNode[];
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);

  if (notices.length === 0) return null;

  // Single notice: just the card, screen-padded to match.
  if (notices.length === 1) {
    return (
      <View style={[{ paddingHorizontal: layout.screenPadding }, style]}>
        {notices[0]}
      </View>
    );
  }

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  // Screen-padded card, minus the peek so the next card shows on the right.
  const cardWidth = width > 0 ? width - layout.screenPadding * 2 - PEEK : 0;
  const snap = cardWidth + GAP;

  return (
    <View style={style} onLayout={onLayout}>
      {width > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={snap}
          snapToAlignment="start"
          disableIntervalMomentum
          // Pad for the shadow, then cancel it so the pager adds no net space.
          style={{ marginVertical: -SHADOW_PAD }}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingVertical: SHADOW_PAD,
          }}
        >
          {notices.map((node, i) => (
            <View
              key={i}
              style={{
                width: cardWidth,
                marginRight: i < notices.length - 1 ? GAP : 0,
              }}
            >
              {node}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
