import { View, Text, Pressable } from "react-native";
import type { ReactNode, ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, pressFeedbackStyle } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { CustomMediaType } from "@tagly/client/components/media/CustomMedia";
import type {
  AdminCustomer,
  AdminAdvertiser,
  AdminBusiness,
  AdminShare,
} from "@tagly/models/v2/adminApp";
import type { MediaPreview } from "@tagly/models/v2/crossApp";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";

/**
 * Entity display cards for the browser + search results. Two shapes:
 *   - Customers / Shares / Advertisers → a horizontal card. The left image grows
 *     to the card's full height (its width follows the aspect ratio: customer pfp
 *     1:1, share = its own AR) so there's no dead space under it. Advertisers have
 *     no image.
 *   - Businesses → a vertical card (16:9 banner on top, info below), rendered two
 *     per row in a grid.
 *
 * v2 design system: `shadow.card` surfaces (no borders), Instagram pfp / banner /
 * share media thumbnails, and a row of multi-color badges to separate the data.
 * Every card takes an optional `onPress` — the list/search screens pass a push
 * to the matching per-uid detail screen.
 */

type IconName = ComponentProps<typeof Ionicons>["name"];
export type BadgeTone = "info" | "highlight" | "money" | "danger" | "ink";

export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    info: { bg: color.accent, fg: color.on.accent },
    highlight: { bg: color.brand, fg: color.on.brand },
    money: { bg: color.successBg, fg: color.on.successBg },
    danger: { bg: color.dangerBg, fg: color.on.dangerBg },
    ink: { bg: color.ink, fg: color.on.ink },
  };
  const { bg, fg } = map[tone];
  return (
    <View
      style={{
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      <Text style={[text.micro, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Title({ children }: { children: string }) {
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <Text style={[text.bodyMedium, { color: color.ink }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function Sub({ children }: { children: string }) {
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <Text
      style={[text.caption, { color: color.text.secondary }]}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

export function BadgeRow({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { spacing } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        marginTop: spacing.xs,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Left image for a horizontal card: stretches to the card's full height, with
 * width = height × aspectRatio (cover-cropped). A missing image (only the
 * customer pfp can be null) falls back to a square icon on a blue fill.
 *
 * The tile renders through `CustomMedia` with `disablePress` so a tap falls
 * through to the surrounding card's `onPress` (per the CustomMedia responder
 * gotcha) rather than opening a fullscreen preview inside a list row.
 */
function HThumb({
  media,
  icon,
  aspectRatio,
}: {
  media: CustomMediaType | null;
  icon: IconName;
  aspectRatio: number;
}) {
  const { theme } = useTheme();
  const { color } = theme;
  if (media) {
    return (
      <CustomMedia
        media={media}
        disablePress
        style={{ alignSelf: "stretch", aspectRatio }}
        backgroundColor={color.accent}
      />
    );
  }
  return (
    <View
      style={{
        alignSelf: "stretch",
        aspectRatio,
        backgroundColor: color.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={30} color={color.on.accent} />
    </View>
  );
}

/** Horizontal card: image left (grows to full height), content right. */
function HCard({
  thumb,
  children,
  onPress,
}: {
  thumb?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout, shadow, radius } = theme;
  return (
    // Outer carries the shadow (no overflow, so it's never clipped); inner clips
    // the thumbnail to the rounded corners.
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }) => [
        { borderRadius: radius.structure, boxShadow: shadow.card },
        onPress ? pressFeedbackStyle({ pressed, hovered }) : null,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          overflow: "hidden",
        }}
      >
        {thumb}
        <View
          style={{
            flex: 1,
            padding: layout.cardPaddingCompact,
            gap: spacing.xs,
            justifyContent: "center",
          }}
        >
          {children}
        </View>
      </View>
    </Pressable>
  );
}

/** Vertical card: 16:9 banner on top, content below (for the 2-up business grid). */
function VCard({
  banner,
  children,
  onPress,
}: {
  banner: MediaPreview;
  children: ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout, shadow, radius } = theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }) => [
        { borderRadius: radius.structure, boxShadow: shadow.card },
        onPress ? pressFeedbackStyle({ pressed, hovered }) : null,
      ]}
    >
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          overflow: "hidden",
        }}
      >
        {/* disablePress → the tap falls through to the card's onPress. */}
        <CustomMedia
          media={banner}
          disablePress
          style={{ width: "100%", aspectRatio: 16 / 9 }}
          backgroundColor={color.brand}
        />
        <View style={{ padding: layout.cardPaddingCompact, gap: spacing.xs }}>
          {children}
        </View>
      </View>
    </Pressable>
  );
}

const multiplierX = (bps: number) => `×${(bps / 10000).toFixed(2)}`;

/** In-progress statuses read blue; PAID green; terminal-bad red. */
export function statusTone(status: string): BadgeTone {
  if (status === "PAID") return "money";
  if (status === "REJECTED" || status === "UNPAYABLE") return "danger";
  return "info";
}

export function CustomerRow({
  item,
  onPress,
}: {
  item: AdminCustomer;
  onPress?: () => void;
}) {
  const ig = item.instagram;
  return (
    <HCard
      onPress={onPress}
      thumb={
        <HThumb
          media={
            ig?.pfpUrl
              ? { url: ig.pfpUrl, type: "IMAGE", aspectRatio: 1 }
              : null
          }
          icon="person"
          aspectRatio={1}
        />
      }
    >
      <Title>{item.fullName || item.email}</Title>
      <Sub>{item.email}</Sub>
      {ig ? (
        <Sub>{`@${ig.username} · ${formatInt(ig.followerCount)} followers`}</Sub>
      ) : null}
      <BadgeRow>
        {item.status === "BANNED" ? (
          <Badge tone="danger" label="Banned" />
        ) : null}
        <Badge
          tone="money"
          label={formatUsd(item.sensitiveData.balanceUsdCents)}
        />
        <Badge
          tone="info"
          label={`${formatInt(item.shareStatistics.totalShares)} shares`}
        />
        <Badge
          tone="highlight"
          label={multiplierX(item.sensitiveData.multiplierBps)}
        />
      </BadgeRow>
    </HCard>
  );
}

export function AdvertiserRow({
  item,
  onPress,
}: {
  item: AdminAdvertiser;
  onPress?: () => void;
}) {
  return (
    <HCard onPress={onPress}>
      <Title>{item.email}</Title>
      <Sub>{`${item.entity ? `${item.entity} · ` : ""}${formatInt(item.businesses.length)} businesses`}</Sub>
      <BadgeRow>
        <Badge
          tone={item.isVisible ? "money" : "danger"}
          label={item.isVisible ? "Visible" : "Hidden"}
        />
        <Badge tone="money" label={formatUsd(item.availableBudgetUsdCents)} />
        <Badge
          tone="info"
          label={`${formatInt(item.shareStatistics.totalShares)} shares`}
        />
        {item.payg.hasActivePaygPeriod ? (
          <Badge tone="highlight" label="PAYG" />
        ) : null}
        {item.monthlyBudget.active ? (
          <Badge tone="highlight" label="Monthly top-up" />
        ) : null}
      </BadgeRow>
    </HCard>
  );
}

export function BusinessRow({
  item,
  onPress,
}: {
  item: AdminBusiness;
  onPress?: () => void;
}) {
  const acc = item.accessibility;
  const owner = item.isSubsidized
    ? "Subsidized by Tagly"
    : (item.advertiser?.email ?? "Unowned");
  return (
    <VCard onPress={onPress} banner={item.banner}>
      <Title>{item.name}</Title>
      <Sub>{`${item.address.city}, ${item.address.country}`}</Sub>
      <Sub>{owner}</Sub>
      <BadgeRow>
        <Badge
          tone={acc.isAccessible ? "money" : "danger"}
          label={acc.isAccessible ? "Visible" : "Hidden"}
        />
        {item.isSubsidized ? (
          <Badge tone="highlight" label="Subsidized" />
        ) : null}
        <Badge
          tone="info"
          label={`${formatInt(item.statistics.totalShares)} shares`}
        />
      </BadgeRow>
    </VCard>
  );
}

export function ShareRow({
  item,
  onPress,
}: {
  item: AdminShare;
  onPress?: () => void;
}) {
  const media = item.thumbnail ?? item.media;
  const reward =
    item.finalRewardCents != null
      ? item.finalRewardCents
      : item.estimatedRewardCents;
  return (
    <HCard
      onPress={onPress}
      thumb={
        <HThumb media={media} icon="image" aspectRatio={media.aspectRatio} />
      }
    >
      <Title>{item.local?.name ?? "Deleted business"}</Title>
      <Sub>{item.customer?.fullName ?? "Deleted customer"}</Sub>
      <Sub>{formatDateTime(item.createdAt)}</Sub>
      <BadgeRow>
        <Badge
          tone={statusTone(item.customerStatus)}
          label={`C: ${item.customerStatus}`}
        />
        {item.visibleToAdvertiser ? (
          <Badge
            tone={statusTone(item.advertiserStatus)}
            label={`A: ${item.advertiserStatus}`}
          />
        ) : (
          <Badge tone="ink" label="A: hidden" />
        )}
        <Badge tone="money" label={formatUsd(reward)} />
      </BadgeRow>
    </HCard>
  );
}
