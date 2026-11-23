import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, Loading, pressFeedbackStyle, TopMenu } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import { FullscreenMediaGallery } from "@tagly/client/components/media/FullscreenMediaGallery";
import type { AdminLedgerEvent } from "@tagly/models/v2/adminApp";
import type { MediaPreview } from "@tagly/models/v2/crossApp";
import { formatUsd, formatDateTime } from "@/utils/format";

/**
 * Building blocks for the per-uid admin detail screens (customer / advertiser /
 * business / share). The screens compose these with the `StatKit` primitives
 * (`StatSection` for collapsible groups, `StatTile` for hero figures):
 *   - `DetailScaffold` — TopMenu (back) + loading / not-found / scroll chrome.
 *   - `InfoRows` — a card of label→value rows; values are selectable (uids,
 *     Stripe ids) and rows with `onPress` become links with a chevron.
 *   - `LedgerEventsList` — the money trail: one block per event with its
 *     non-zero balance deltas and raw meta.
 *   - `MediaCarousel` — contained banner + full-width photo strip, each tile
 *     tapping into a swipeable fullscreen gallery (mirrors the customer app's
 *     business-details media block). Every tile is a `CustomMedia`.
 */

/** "—" for null/undefined/empty. */
export function orDash(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export function yesNo(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

/** Basis points → "×1.05". */
export function formatBpsMultiplier(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `×${(bps / 10000).toFixed(2)}`;
}

export type InfoRow = {
  label: string;
  value: string;
  /** money = green value; muted = secondary; danger = red (errors/bans). */
  tone?: "default" | "money" | "muted" | "danger";
  /** Makes the whole row tappable + press feedback. Trailing icon by `link`. */
  onPress?: () => void;
  /**
   * How the `onPress` reads:
   *   - `"nav"` (default) — internal push to another admin screen; chevron.
   *   - `"external"` — opens outside the app (Instagram / mailto / Stripe /
   *     maps); the value renders underlined in ink and the icon is `open-outline`.
   */
  link?: "nav" | "external";
};

/** A card of label→value rows with hairline dividers. Values are selectable. */
export function InfoRows({ rows }: { rows: InfoRow[] }) {
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
        const isExternal = r.onPress != null && r.link === "external";
        const valueColor =
          r.tone === "money"
            ? color.success
            : r.tone === "muted"
              ? color.text.secondary
              : r.tone === "danger"
                ? color.danger
                : color.ink;
        const inner = (
          <>
            <Text
              style={[text.caption, { color: color.text.secondary, flexShrink: 0 }]}
              numberOfLines={2}
            >
              {r.label}
            </Text>
            <Text
              style={[
                text.label,
                {
                  color: valueColor,
                  flex: 1,
                  textAlign: "right",
                  // External links read as tappable text (underlined, per the
                  // PressableText affordance); internal-nav rows use the chevron.
                  ...(isExternal ? { textDecorationLine: "underline" as const } : null),
                },
              ]}
              numberOfLines={3}
              selectable={!r.onPress}
            >
              {r.value}
            </Text>
            {r.onPress ? (
              <Ionicons
                name={isExternal ? "open-outline" : "chevron-forward"}
                size={14}
                color={color.text.tertiary}
              />
            ) : null}
          </>
        );
        const rowStyle = {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: spacing.md,
          minHeight: layout.minTapTarget,
          paddingVertical: spacing.xs,
          borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: color.border.divider,
        };
        return r.onPress ? (
          <Pressable
            key={`${r.label}-${i}`}
            onPress={r.onPress}
            style={({ pressed, hovered }) => [
              rowStyle,
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={`${r.label}-${i}`} style={rowStyle}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

const DELTA_FIELDS: { key: keyof AdminLedgerEvent; label: string }[] = [
  { key: "deltaAdvertiserCents", label: "Advertiser" },
  { key: "deltaAdvertiserLockedCents", label: "Advertiser locked" },
  { key: "deltaCustomerCents", label: "Customer" },
  { key: "deltaCustomerLockedCents", label: "Customer locked" },
  { key: "deltaPlatformCents", label: "Platform" },
  { key: "deltaPlatformLockedCents", label: "Platform locked" },
];

/** Signed USD: green when positive, ink when negative/zero. */
function signedUsd(cents: number): string {
  return `${cents > 0 ? "+" : ""}${formatUsd(cents)}`;
}

/**
 * Turn a machine `meta` key into a readable, sentence-cased label:
 * `shortfallCents` / `payg_period_id` / `SHARE_LOCK` → "Shortfall cents" /
 * "Payg period id" / "Share lock". Splits on separators + camelCase boundaries.
 */
function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return key;
  const sentence = words.map((w) => w.toLowerCase()).join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** One flattened `meta` line: a leaf `row` (key → value) or a nested-object
 * `group` header (key only, children follow indented). Flattening to a list lets
 * every line get a zebra stripe by its running index, nesting included. */
type MetaLine =
  | { kind: "row"; label: string; value: string; indent: number }
  | { kind: "group"; label: string; indent: number };

/** Depth-first flatten of the `meta` bag into ordered lines, keys humanized. */
function flattenMeta(meta: Record<string, unknown>, indent = 0): MetaLine[] {
  const lines: MetaLine[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      lines.push({ kind: "group", label: humanizeKey(key), indent });
      lines.push(...flattenMeta(value as Record<string, unknown>, indent + 1));
    } else {
      lines.push({
        kind: "row",
        label: humanizeKey(key),
        value: String(value),
        indent,
      });
    }
  }
  return lines;
}

/**
 * The event `meta` bag as small lines under a hairline divider — replacing a raw
 * JSON dump, mirroring origin/main's ledger preview. Each line alternates a warm
 * zebra tint (every other line a touch darker) so adjacent lines are easy to
 * tell apart; within a line the key is muted (tertiary / secondary for a group
 * header) and the value strong (primary) for a second readability cue.
 */
function MetaLines({ meta }: { meta: Record<string, unknown> }) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const lines = flattenMeta(meta);
  return (
    <View
      style={{
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: color.border.divider,
      }}
    >
      {lines.map((line, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
            paddingVertical: 2,
            paddingRight: 6,
            paddingLeft: 6 + line.indent * 12,
            borderRadius: radius.button,
            // Zebra: every other line (2, 4, 6…) a touch darker.
            backgroundColor: i % 2 === 1 ? color.border.divider : "transparent",
          }}
        >
          <Text
            style={[
              text.micro,
              {
                color:
                  line.kind === "group"
                    ? color.text.secondary
                    : color.text.tertiary,
                flexShrink: 1,
              },
            ]}
          >
            {line.label}
          </Text>
          {line.kind === "row" ? (
            <Text
              style={[
                text.micro,
                {
                  color: color.text.primary,
                  flexShrink: 1,
                  textAlign: "right",
                },
              ]}
              selectable
              numberOfLines={1}
            >
              {line.value}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One ledger event as a card — kind + timestamp, only the non-zero balance
 * deltas, an optional share link, and the `meta` bag as small lines. The single
 * canonical renderer, shared by the detail-screen `LedgerEventsList` (embedded
 * trails) and the paginated `transactions/from/[uid]` screen (entity-wide feed).
 */
export function LedgerEventCard({
  event: e,
  onPressShare,
}: {
  event: AdminLedgerEvent;
  onPressShare?: (shareUid: string) => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        boxShadow: shadow.card,
        padding: layout.cardPaddingCompact,
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Text style={[text.label, { color: color.ink, flexShrink: 1 }]}>
          {e.kind}
        </Text>
        <Text style={[text.micro, { color: color.text.tertiary }]}>
          {formatDateTime(e.createdAt)}
        </Text>
      </View>
      {DELTA_FIELDS.filter((f) => (e[f.key] as number) !== 0).map((f) => {
        const cents = e[f.key] as number;
        return (
          <View
            key={f.key}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {f.label}
            </Text>
            <Text
              style={[
                text.amountSm,
                { color: cents > 0 ? color.success : color.ink },
              ]}
            >
              {signedUsd(cents)}
            </Text>
          </View>
        );
      })}
      {e.shareUid && onPressShare ? (
        <Pressable
          onPress={() => onPressShare(e.shareUid as string)}
          style={({ pressed, hovered }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: layout.minTapTarget,
            },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <Text style={[text.caption, { color: color.text.secondary }]}>
            Share
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Text style={[text.label, { color: color.ink }]}>{e.shareUid}</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={color.text.tertiary}
            />
          </View>
        </Pressable>
      ) : null}
      {e.meta && Object.keys(e.meta).length > 0 ? (
        <MetaLines meta={e.meta} />
      ) : null}
    </View>
  );
}

/**
 * The money trail: a stack of `LedgerEventCard`s (one per event). Used inside
 * the detail screens for the embedded per-purchase / per-withdrawal trails.
 */
export function LedgerEventsList({
  events,
  onPressShare,
}: {
  events: AdminLedgerEvent[];
  onPressShare?: (shareUid: string) => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  if (events.length === 0) {
    return (
      <View
        style={{
          flexBasis: "100%",
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          boxShadow: shadow.card,
          padding: layout.cardPadding,
        }}
      >
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          No ledger events.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flexBasis: "100%", gap: spacing.md }}>
      {events.map((e, i) => (
        <LedgerEventCard
          key={`${e.kind}-${e.createdAt}-${i}`}
          event={e}
          onPressShare={onPressShare}
        />
      ))}
    </View>
  );
}

/**
 * Business media block: a contained banner above a full-width horizontal photo
 * strip, every tile a `CustomMedia`. Tapping any tile opens a swipeable
 * fullscreen gallery over `[banner, ...photos]` at that index — the same shape
 * as the customer app's business-details screen. Thumbnails keep their own
 * aspect ratio and are sized to ~a third of the screen width.
 */
export function MediaCarousel({
  banner,
  photos,
}: {
  banner: MediaPreview;
  photos: MediaPreview[];
}) {
  const { theme } = useTheme();
  const { color, spacing, radius, shadow, layout } = theme;
  const { width } = useWindowDimensions();

  // Index into [banner, ...photos] currently open in the fullscreen gallery.
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const galleryMedia: MediaPreview[] = [banner, ...photos];
  const thumbHeight = Math.round((width - layout.screenPadding * 2) / 3);

  return (
    <View style={{ gap: spacing.xs }}>
      {/* Banner — contained; CustomMedia owns the tap → opens the gallery. */}
      <View
        style={{
          aspectRatio: banner.aspectRatio,
          borderRadius: radius.structure,
          overflow: "hidden",
          boxShadow: shadow.card,
        }}
      >
        <CustomMedia
          media={banner}
          disableFullscreenPreview
          onPress={() => setGalleryIndex(0)}
          style={{ flex: 1 }}
          backgroundColor={color.brand}
        />
      </View>

      {/* Photos — horizontal strip; each keeps its aspect ratio. The vertical
          padding gives the cards' shadow room so the ScrollView doesn't clip it. */}
      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingVertical: spacing.sm,
          }}
        >
          {photos.map((photo, i) => (
            <View
              key={photo.uid}
              style={{
                height: thumbHeight,
                aspectRatio: photo.aspectRatio,
                borderRadius: radius.structure,
                overflow: "hidden",
                boxShadow: shadow.card,
              }}
            >
              <CustomMedia
                media={photo}
                disableFullscreenPreview
                onPress={() => setGalleryIndex(i + 1)}
                style={{ flex: 1 }}
                backgroundColor={color.brand}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* Fullscreen swipeable gallery (banner + photos). Mounted only while open
          so it remounts each time and resets the pager. */}
      {galleryIndex !== null ? (
        <FullscreenMediaGallery
          media={galleryMedia}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * Shared chrome for a pushed per-uid detail screen: TopMenu (back), centered
 * spinner while loading, a not-found message when the fetch failed, and the
 * scroll container (screen padding + bottom inset) around `children`.
 */
export function DetailScaffold({
  title,
  loading,
  found,
  children,
}: {
  title: string;
  loading: boolean;
  found: boolean;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={title} showBack hideMenu />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Loading />
        </View>
      ) : !found ? (
        <Text
          style={[
            text.body,
            {
              color: color.danger,
              paddingHorizontal: layout.screenPadding,
              marginTop: spacing.xl,
            },
          ]}
        >
          Couldn't load this record. It may have been deleted.
        </Text>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: layout.screenPadding,
            paddingHorizontal: layout.screenPadding,
            paddingBottom: insets.bottom + layout.screenPadding,
          }}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}
