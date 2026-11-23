import { useMemo, useRef } from "react";
import { View, PanResponder } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
import { MIN_RATING_STARS, MAX_RATING_STARS } from "@tagly/models/shared";

// `shadow.text` draws ~2px above / ~4px below the glyph (offset {0,1} + blur 3);
// this padding gives the text frame room so the drop isn't clipped.
const SHADOW_ROOM = { paddingTop: 2, paddingBottom: 4 } as const;

/**
 * Star rating in the canonical half-star unit (1–10 = ½★–5★; `null`/0 = unrated).
 * One component, two modes:
 *   - **display** (`readOnly`): renders filled / half / empty stars for `value`.
 *   - **input**: the whole row is one gesture surface. Tapping OR dragging maps
 *     the finger's x-position across the row to a half-star value (the standard
 *     mobile rating gesture) — so half-stars are as easy to hit as full ones, and
 *     you can slide to fine-tune without lifting. `x0`/`moveX` are page
 *     coordinates measured against the row's window frame (cached on layout).
 *
 * Filled glyphs carry `shadow.text` (the one warm glyph-lift the design system
 * allows for rating stars). Butter (`color.brand`) is the fill; empty is tertiary.
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 28,
}: {
  /** Half-star units 1–10, or null/0 when unrated. */
  value: number | null;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const { theme } = useTheme();
  const { color, spacing, shadow, layout } = theme;
  const v = value ?? 0;
  const gap = readOnly ? 2 : spacing.sm;

  // Latest onChange + geometry + the row's measured window origin, all read
  // inside the PanResponder (created once) so its handlers never capture a
  // stale closure.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const geom = useRef({ size, gap });
  geom.current = { size, gap };
  const frame = useRef({ x: 0, measured: false });
  const rowRef = useRef<View>(null);

  const measure = () =>
    rowRef.current?.measureInWindow((x) => {
      frame.current = { x, measured: true };
    });

  const setFromX = (pageX: number) => {
    const { x, measured } = frame.current;
    if (!measured) return;
    // Map against the glyph run's DETERMINISTIC width (5 glyphs + 4 gaps),
    // never the row's measured width: the row is a plain View, so a default
    // (stretch) column parent makes it full-width while the glyphs stay
    // left-anchored — mapping across the stretched width lands taps on the
    // wrong star (tapping the 5th star read as ~3★). Anchor to the row's left
    // edge and clamp, so a tap right of the last star reads as 5★.
    const { size: s, gap: g } = geom.current;
    const glyphRunWidth = 5 * s + 4 * g;
    if (glyphRunWidth <= 0) return;
    const ratio = Math.min(Math.max((pageX - x) / glyphRunWidth, 0), 1);
    // ceil → the first sliver of a star lights its half; the star's right
    // portion fills it. Clamped to the 1–10 valid range.
    const next = Math.min(
      MAX_RATING_STARS,
      Math.max(MIN_RATING_STARS, Math.ceil(ratio * 10)),
    );
    onChangeRef.current?.(next);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // A touch that lands on the row belongs to the rating control: grab it on
        // touch-down (so a plain tap sets the value) and refuse to hand it back
        // (`terminationRequest`), so the parent ScrollView can't yank the drag away
        // mid-gesture — that tug-of-war was the drag "bug". Scrolling the sheet is
        // done from anywhere else (media above, buttons below), not the stars.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, g) => setFromX(g.x0),
        onPanResponderMove: (_e, g) => setFromX(g.moveX),
      }),
    [],
  );

  const stars = Array.from({ length: 5 }, (_, idx) => {
    const starIndex = idx + 1; // 1..5
    const full = starIndex * 2; // half-star unit for a full star
    const half = full - 1;
    const name = v >= full ? "star" : v >= half ? "star-half" : "star-outline";
    const filled = v >= half;
    return (
      <Ionicons
        key={starIndex}
        name={name}
        size={size}
        color={filled ? color.brand : color.text.tertiary}
        // Vertical room so `shadow.text` (offset + blur) isn't clipped by the
        // glyph's own text frame — the shadow is a fixed size, so a constant pad
        // covers every star size (worst at the 13px preview). Applied to every
        // glyph (not just filled ones) so the row stays vertically aligned.
        style={[SHADOW_ROOM, filled ? shadow.text : null]}
      />
    );
  });

  if (readOnly) {
    return <View style={{ flexDirection: "row", gap }}>{stars}</View>;
  }

  // Input: one gesture surface over the whole row. Generous vertical padding
  // keeps the grab area ≥ the min tap target without spacing the glyphs apart.
  return (
    <View
      ref={rowRef}
      onLayout={measure}
      hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
      style={{
        flexDirection: "row",
        gap,
        paddingVertical: Math.max(0, (layout.minTapTarget - size) / 2),
      }}
      {...pan.panHandlers}
    >
      {stars}
    </View>
  );
}

/** Clamp helper so callers never store an out-of-range rating. */
export function clampRatingStars(stars: number): number {
  return Math.max(MIN_RATING_STARS, Math.min(MAX_RATING_STARS, stars));
}
