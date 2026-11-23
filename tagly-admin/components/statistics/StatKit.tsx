import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import type { ReactNode, ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LineChart as GiftedLineChart, CurveType } from "react-native-gifted-charts";
import { useTheme, pressFeedbackStyle } from "@tagly/client";

/**
 * Statistics primitives for the admin dashboard. Ported from origin/main's
 * `components/statistics/*` (StatSection / TopList / trend charts) onto the v2
 * design system: warm `shadow.card` surfaces (no borders), ink/green tokens, the
 * spacing scale, Playfair section headings, and sans figures. Trends render as a
 * native SVG area chart (`react-native-svg`) since origin's recharts is web-only.
 *
 * Sections are collapsible (the dashboard packs a lot of numbers): each has a
 * tinted icon chip and, while collapsed, a one-figure summary so the screen
 * scans as a compact index that expands on demand. Inside a section the layout
 * is two "hero" `StatTile`s (the headline figures, with a tinted icon chip)
 * over one dense `StatRows` card for everything secondary — tiles for every
 * stat left the cards mostly empty.
 */

// Classic-arch Android needs the experimental flag for LayoutAnimation; the
// new architecture ignores it (and newer RN versions drop the setter).
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tone = "default" | "money" | "muted";
type IconName = ComponentProps<typeof Ionicons>["name"];
/** Which accent family a section's icon chip uses (small fills only). */
export type SectionTint = "money" | "accent" | "brand";

function chipColors(
  tint: SectionTint,
  color: ReturnType<typeof useTheme>["theme"]["color"],
) {
  return tint === "money"
    ? { bg: color.successBg, fg: color.on.successBg }
    : tint === "brand"
      ? { bg: color.brand, fg: color.on.brand }
      : { bg: color.accent, fg: color.on.accent };
}

/**
 * A headline figure in a card. With `chip` set the icon sits in a tinted
 * circle at the top-right corner (hero style, matching the section chip);
 * without it the icon renders inline by the label.
 */
export function StatTile({
  label,
  value,
  icon,
  chip,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon?: IconName;
  /** Render the icon in a tinted circle top-right (hero tile). */
  chip?: SectionTint;
  tone?: Tone;
  hint?: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const valueColor =
    tone === "money"
      ? color.success
      : tone === "muted"
        ? color.text.secondary
        : color.ink;
  const chipC = chip ? chipColors(chip, color) : null;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "47%",
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPaddingCompact,
        boxShadow: shadow.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {icon && !chipC ? (
          <Ionicons name={icon} size={14} color={color.text.tertiary} />
        ) : null}
        <Text
          style={[text.caption, { color: color.text.secondary, flex: 1 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {icon && chipC ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.pill,
              backgroundColor: chipC.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={14} color={chipC.fg} />
          </View>
        ) : null}
      </View>
      <Text
        style={[
          text.amount,
          { color: valueColor, marginTop: chipC ? 0 : spacing.xs },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? (
        <Text
          style={[text.micro, { color: color.text.tertiary, marginTop: spacing.xs }]}
          numberOfLines={2}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The dense companion to the hero tiles: one card listing secondary stats as
 * compact rows (icon + label + optional hint on the left, figure on the
 * right), hairline dividers between rows. Full-width inside a section grid.
 */
export function StatRows({
  rows,
}: {
  rows: {
    icon?: IconName;
    label: string;
    value: string;
    hint?: string;
    tone?: Tone;
  }[];
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "100%",
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        boxShadow: shadow.card,
        paddingHorizontal: layout.cardPadding,
      }}
    >
      {rows.map((r, i) => {
        const valueColor =
          r.tone === "money"
            ? color.success
            : r.tone === "muted"
              ? color.text.secondary
              : color.ink;
        return (
          <View
            key={`${r.label}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              // Uniform row height whether or not a hint is present — mixed
              // heights made the cards look ragged.
              minHeight: layout.minTapTarget,
              paddingVertical: spacing.xs,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: color.border.divider,
            }}
          >
            {r.icon ? (
              <Ionicons name={r.icon} size={15} color={color.text.tertiary} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[text.label, { color: color.text.primary }]}
                numberOfLines={1}
              >
                {r.label}
              </Text>
              {r.hint ? (
                <Text
                  style={[text.micro, { color: color.text.tertiary }]}
                  numberOfLines={1}
                >
                  {r.hint}
                </Text>
              ) : null}
            </View>
            <Text style={[text.amountSm, { color: valueColor }]} numberOfLines={1}>
              {r.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * A collapsible titled section: a tappable header (tinted icon chip + Playfair
 * heading + a collapsed one-figure summary + chevron) over a wrapping grid of
 * tiles/children. `tint` differentiates section families — `money` (green) for
 * revenue/financials, `accent` (blue) for people, `brand` (butter) for
 * activity/content. Content stays directly on the cream background so the
 * white tiles keep their shadow separation.
 */
export function StatSection({
  title,
  icon,
  tint = "accent",
  summary,
  defaultOpen = false,
  children,
  footer,
}: {
  title: string;
  icon: IconName;
  tint?: SectionTint;
  /** Headline figure shown at the right edge while the section is collapsed. */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const [open, setOpen] = useState(defaultOpen);
  const chip = chipColors(tint, color);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed, hovered }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            minHeight: layout.minTapTarget,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            backgroundColor: chip.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={16} color={chip.fg} />
        </View>
        <Text style={[text.heading, { color: color.ink, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        {!open && summary ? (
          <Text
            style={[
              text.amountSm,
              { color: tint === "money" ? color.success : color.ink },
            ]}
            numberOfLines={1}
          >
            {summary}
          </Text>
        ) : null}
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={color.text.tertiary}
        />
      </Pressable>
      {open ? (
        <>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.md,
              marginTop: spacing.md,
            }}
          >
            {children}
          </View>
          {footer}
        </>
      ) : null}
    </View>
  );
}

/**
 * A ranked list inside one card — small caption title, hairline dividers
 * between rows. Full-width, so it can sit inside a `StatSection` grid next to
 * (or below) the stat tiles.
 */
export function TopList({
  title,
  rows,
  valueTone = "default",
}: {
  title: string;
  rows: { label: string; value: string }[];
  valueTone?: Tone;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "100%",
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        boxShadow: shadow.card,
        paddingHorizontal: layout.cardPadding,
        paddingTop: layout.cardPaddingCompact,
      }}
    >
      <Text style={[text.caption, { color: color.text.secondary }]} numberOfLines={1}>
        {title}
      </Text>
      {rows.length === 0 ? (
        <Text
          style={[
            text.caption,
            { color: color.text.tertiary, paddingVertical: spacing.md },
          ]}
        >
          No data yet.
        </Text>
      ) : (
        rows.map((r, i) => (
          <View
            key={`${r.label}-${i}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: spacing.sm,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: color.border.divider,
            }}
          >
            <Text
              style={[
                text.label,
                { color: color.text.primary, flex: 1, marginRight: spacing.md },
              ]}
              numberOfLines={1}
            >
              {r.label}
            </Text>
            <Text
              style={[
                text.amountSm,
                { color: valueTone === "money" ? color.success : color.ink },
              ]}
            >
              {r.value}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Default compact axis formatter: 1234 → "1.2k", 3400000 → "3.4M". */
function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

/**
 * A trend chart (curved line + gradient area fill), oldest → newest — the v2
 * replacement for origin/main's recharts charts, built on
 * `react-native-gifted-charts` (over `react-native-svg` + `expo-linear-gradient`).
 * Sits in its own white surface card; auto-sizes to the card width via
 * `onLayout`. `money` tone draws green; otherwise ink. Y-axis values render at
 * every rule line (compact via `formatAxisValue`, default 1.2k-style) and
 * every third month is labelled along the x-axis. Long-pressing activates a
 * pointer that shows the exact month + figure in a floating bubble
 * (long-press, not touch, so vertical scrolling over the chart keeps working;
 * `stripOverPointer` keeps the bubble ABOVE the pointer dot — the default
 * renders pointers after the label, hiding the number behind the dot).
 *
 * Two clipping guards: the curve uses `CurveType.QUADRATIC` (midpoint Q-curves
 * stay inside the data's hull — the default cubic bezier overshoots below zero
 * on flat-then-rising series and the area gets clipped flat at the baseline),
 * and genuinely negative values shift the baseline via `yAxisOffset` (the lib
 * subtracts the offset from every value; axis labels add it back, so they
 * still show true values).
 */
export function LineChart({
  title,
  data,
  tone = "ink",
  height = 160,
  formatValue,
  formatAxisValue = compactNumber,
}: {
  /** What the series is (e.g. "New shares per month") — shown above the chart. */
  title: string;
  data: { label: string; value: number }[];
  tone?: "ink" | "money";
  height?: number;
  /** Full-precision formatter for the pointer bubble. */
  formatValue?: (v: number) => string;
  /** Compact formatter for the y-axis labels (defaults to 1.2k style). */
  formatAxisValue?: (v: number) => string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const [w, setW] = useState(0);

  if (data.length === 0) return null;

  const stroke = tone === "money" ? color.success : color.ink;
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Headroom above the peak; when the series dips negative, drop the baseline
  // below the trough (yAxisOffset) so the line isn't clipped at the bottom.
  const yAxisOffset = min < 0 ? Math.floor(min * 1.15) : 0;
  const maxValue = Math.max(1, Math.ceil(max * 1.15) - yAxisOffset);
  const yLabelWidth = 40;
  const initial = 8;
  const end = 8;
  const n = data.length;
  const plotWidth = Math.max(0, w - yLabelWidth);
  const chartSpacing =
    plotWidth > 0 && n > 1 ? (plotWidth - initial - end) / (n - 1) : 1;
  const fmt = (v: number) => (formatValue ? formatValue(v) : String(v));

  return (
    <View
      style={{
        marginTop: spacing.md,
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        boxShadow: shadow.card,
        padding: layout.cardPaddingCompact,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <Text
          style={[text.caption, { color: color.text.secondary, flexShrink: 1 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[text.micro, { color: color.text.tertiary }]}>
          hold to inspect
        </Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <GiftedLineChart
            data={data.map((d, i) => ({
              value: d.value,
              // Every third month labelled — all twelve would collide.
              label: i % 3 === 0 ? d.label : "",
            }))}
            width={plotWidth}
            height={height}
            maxValue={maxValue}
            yAxisOffset={yAxisOffset}
            areaChart
            curved
            curveType={CurveType.QUADRATIC}
            color={stroke}
            thickness={2}
            startFillColor={stroke}
            endFillColor={stroke}
            startOpacity={0.18}
            endOpacity={0.02}
            dataPointsColor={stroke}
            dataPointsRadius={2.5}
            spacing={chartSpacing}
            initialSpacing={initial}
            endSpacing={end}
            rulesColor={color.border.divider}
            rulesType="dashed"
            noOfSections={4}
            yAxisThickness={0}
            yAxisLabelWidth={yLabelWidth}
            yAxisTextStyle={{ ...text.micro, color: color.text.tertiary }}
            formatYLabel={(label: string) => {
              const num = Number(label);
              return Number.isFinite(num) ? formatAxisValue(num) : label;
            }}
            xAxisLabelTextStyle={{
              ...text.micro,
              color: color.text.tertiary,
            }}
            xAxisThickness={0}
            hideAxesAndRules={false}
            disableScroll
            adjustToWidth
            pointerConfig={{
              // Long-press (not plain touch) so the surrounding ScrollView
              // still scrolls when the finger lands on the chart.
              activatePointersOnLongPress: true,
              activatePointersDelay: 200,
              pointerStripColor: color.border.divider,
              pointerStripWidth: 1,
              pointerColor: stroke,
              radius: 4,
              pointerLabelWidth: 104,
              autoAdjustPointerLabelPosition: true,
              // Render the strip + label AFTER the pointer dots — the default
              // order draws the dot over the bubble, hiding the number.
              stripOverPointer: true,
              // The lib passes sanitised (offset-shifted) items — look the
              // real figure up by index instead.
              pointerLabelComponent: (
                _items: unknown,
                _secondary: unknown,
                pointerIndex: number,
              ) => {
                const d = data[pointerIndex];
                if (!d) return null;
                return (
                  <View
                    style={{
                      backgroundColor: color.surface,
                      borderRadius: radius.structure,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      boxShadow: shadow.float,
                      alignItems: "center",
                      alignSelf: "center",
                    }}
                  >
                    <Text style={[text.micro, { color: color.text.tertiary }]}>
                      {d.label}
                    </Text>
                    <Text style={[text.amountSm, { color: stroke }]}>
                      {fmt(d.value)}
                    </Text>
                  </View>
                );
              },
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
