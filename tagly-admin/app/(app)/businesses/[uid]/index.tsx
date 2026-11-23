import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  useCatalogLocalizer,
  CustomButton,
  isBusinessOpenNow,
  formatTimeOfDay,
} from "@tagly/client";
import { adminGetBusinessByUid } from "@tagly/sdk/v2/adminApp";
import type { AdminBusiness } from "@tagly/models/v2/adminApp";
import type { LocalSubaccountUid } from "@tagly/models/shared";
import { StatSection, StatTile } from "@/components/statistics/StatKit";
import {
  DetailScaffold,
  InfoRows,
  MediaCarousel,
  orDash,
  yesNo,
  type InfoRow,
} from "@/components/details/DetailKit";
import { Badge, BadgeRow } from "@/components/entities/EntityRows";
import {
  SubsidizeButton,
  BanButton,
  AssignAdvertiserButton,
} from "@/components/details/BusinessActions";
import { QrStickerSection } from "@/components/details/QrStickerSection";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";
import {
  openUrl,
  instagramProfileUrl,
  mapsUrl,
  emailUrl,
  phoneUrl,
} from "@/utils/links";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** One opening-hours interval as "9:00 AM - 5:00 PM", or "Open 24 hours". */
function formatInterval(p: {
  openMinute: number;
  closeMinute: number;
}): string {
  if (p.openMinute === 0 && p.closeMinute === 1440) return "Open 24 hours";
  return `${formatTimeOfDay(p.openMinute)} - ${formatTimeOfDay(p.closeMinute)}`;
}

/**
 * Business detail — `GET /v2/admin/businesses/:uid`, the full `AdminBusiness`
 * DTO in collapsible sections. The headline is the accessibility verdict (why
 * customers can / can't see it right now, with the raw facts behind the rule),
 * plus info, contact + web links (with moderation status), address, owning
 * advertiser (link), subsidization, statistics, opening hours (live "open now"),
 * and the photo carousel. Reached from any business preview.
 */
export default function AdminBusinessDetailScreen() {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { typeName } = useCatalogLocalizer();

  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) =>
        adminGetBusinessByUid({
          jwt,
          params: { uid: uid as LocalSubaccountUid },
        }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setBusiness(res.data.business);
    setLoading(false);
  }, [router, uid]);

  // Refetch on every focus (not just mount) so returning from an edit screen
  // shows the fresh data; only the first load shows the spinner.
  useFocusEffect(
    useCallback(() => {
      void fetchBusiness();
    }, [fetchBusiness]),
  );

  const b = business;
  const acc = b?.accessibility ?? null;
  const openNow = b ? isBusinessOpenNow(b.openingHours, b.timezone) : null;

  // A web link (website / menu / reservation) as an InfoRows row. Shows the
  // moderation status when it isn't APPROVED (customers only ever see APPROVED),
  // and opens the url externally.
  const linkRow = (
    label: string,
    link: AdminBusiness["websiteLink"],
  ): InfoRow | null =>
    link
      ? {
          label:
            link.status === "APPROVED"
              ? label
              : `${label} · ${link.status.toLowerCase()}`,
          value: link.url,
          tone:
            link.status === "REJECTED"
              ? "danger"
              : link.status === "PENDING"
                ? "muted"
                : "default",
          link: "external",
          onPress: () => openUrl(link.url),
        }
      : null;

  return (
    <DetailScaffold
      title={b ? b.name : "Business"}
      loading={loading}
      found={b != null}
    >
      {b && acc ? (
        <>
          {/* Header — banner + photo carousel (tap → fullscreen gallery),
              then name + type + headline badges */}
          <MediaCarousel banner={b.banner} photos={b.photos} />
          <Text
            style={[text.title, { color: color.ink, marginTop: spacing.md }]}
            numberOfLines={2}
          >
            {b.name}
          </Text>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {`${typeName(b.type.slug)} · ${b.address.city}, ${b.address.country}`}
          </Text>
          <BadgeRow>
            <Badge
              tone={acc.isAccessible ? "money" : "danger"}
              label={acc.isAccessible ? "Visible" : "Hidden"}
            />
            <Badge tone="info" label={b.status} />
            {b.isSubsidized ? <Badge tone="highlight" label="Subsidized" /> : null}
            <Badge tone="info" label={`${formatInt(b.statistics.totalShares)} shares`} />
          </BadgeRow>

          <StatSection title="Info" icon="storefront-outline" tint="accent" defaultOpen>
            <InfoRows
              rows={[
                { label: "UID", value: b.uid },
                { label: "Name", value: b.name },
                { label: "Description", value: orDash(b.description) },
                { label: "Type", value: `${typeName(b.type.slug)} (${b.type.slug})` },
                {
                  label: "Tags",
                  value: b.tags.length > 0 ? b.tags.join(", ") : "—",
                },
                {
                  label: "Instagram tag",
                  value: b.instagramTag ? `@${b.instagramTag}` : "—",
                  ...(b.instagramTag
                    ? {
                        link: "external" as const,
                        onPress: () =>
                          openUrl(instagramProfileUrl(b.instagramTag as string)),
                      }
                    : null),
                },
                { label: "Status", value: b.status },
                { label: "Created", value: formatDateTime(b.createdAt) },
                { label: "Updated", value: formatDateTime(b.updatedAt) },
              ]}
            />
            <BanButton business={b} onDone={() => void fetchBusiness()} />
          </StatSection>

          {/* Edit — pushes the shared pageForm edit screens (basics / media /
              details+tags), wired to PATCH + media init/confirm on /v2/admin.
              DELETED pages are not editable (the backend 404s them). */}
          {b.status !== "DELETED" ? (
            <StatSection title="Edit page" icon="create-outline" tint="accent">
              <InfoRows
                rows={[
                  {
                    label: "Name, type and address",
                    value: "Edit",
                    link: "nav",
                    onPress: () => router.push(`/businesses/${b.uid}/edit/basics`),
                  },
                  {
                    label: "Banner and photos",
                    value: "Edit",
                    link: "nav",
                    onPress: () => router.push(`/businesses/${b.uid}/edit/media`),
                  },
                  {
                    label: "Details, hours and tags",
                    value: "Edit",
                    link: "nav",
                    onPress: () =>
                      router.push(`/businesses/${b.uid}/edit/details`),
                  },
                ]}
              />
            </StatSection>
          ) : null}

          <StatSection
            title="Contact"
            icon="call-outline"
            tint="accent"
            summary={b.contactEmail ?? b.phoneNumber ?? "—"}
          >
            <InfoRows
              rows={[
                {
                  label: "Email",
                  value: orDash(b.contactEmail),
                  ...(b.contactEmail
                    ? {
                        link: "external" as const,
                        onPress: () => openUrl(emailUrl(b.contactEmail as string)),
                      }
                    : null),
                },
                {
                  label: "Phone",
                  value: orDash(b.phoneNumber),
                  ...(b.phoneNumber
                    ? {
                        link: "external" as const,
                        onPress: () => openUrl(phoneUrl(b.phoneNumber as string)),
                      }
                    : null),
                },
                ...([
                  linkRow("Website", b.websiteLink),
                  linkRow("Menu", b.menuLink),
                  linkRow("Reservation", b.reservationLink),
                ].filter(Boolean) as InfoRow[]),
              ]}
            />
          </StatSection>

          <StatSection
            title="Address"
            icon="location-outline"
            tint="brand"
            summary={b.address.city}
          >
            <InfoRows
              rows={[
                { label: "Street", value: b.address.street },
                { label: "City", value: b.address.city },
                { label: "Region", value: orDash(b.address.region) },
                { label: "ZIP", value: b.address.zip },
                { label: "Country", value: b.address.country },
                {
                  label: "Location",
                  value: `${b.address.location.lat.toFixed(5)}, ${b.address.location.lon.toFixed(5)}`,
                  link: "external",
                  onPress: () =>
                    openUrl(
                      mapsUrl(b.address.location.lat, b.address.location.lon),
                    ),
                },
                {
                  label: "City location",
                  value: b.cityLocation
                    ? `${b.cityLocation.lat.toFixed(5)}, ${b.cityLocation.lon.toFixed(5)}`
                    : "—",
                  ...(b.cityLocation
                    ? {
                        link: "external" as const,
                        onPress: () => {
                          const loc = b.cityLocation;
                          if (loc) openUrl(mapsUrl(loc.lat, loc.lon));
                        },
                      }
                    : null),
                },
              ]}
            />
          </StatSection>

          {b.openingHours.length > 0 ? (
            <StatSection
              title="Opening hours"
              icon="time-outline"
              tint="brand"
              summary={
                openNow === null
                  ? undefined
                  : openNow
                    ? "Open now"
                    : "Closed now"
              }
            >
              <InfoRows
                rows={[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const intervals = b.openingHours.filter(
                    (p) => p.dayOfWeek === day,
                  );
                  return {
                    label: DAY_LABELS[day],
                    value:
                      intervals.length === 0
                        ? "Closed"
                        : intervals.map(formatInterval).join(", "),
                    tone: intervals.length === 0 ? "muted" : "default",
                  };
                })}
              />
            </StatSection>
          ) : null}

          <StatSection
            title="Accessibility"
            icon="eye-outline"
            tint={acc.isAccessible ? "money" : "brand"}
            summary={acc.isAccessible ? "Visible" : "Hidden"}
            defaultOpen
          >
            <InfoRows
              rows={[
                {
                  label: "Accessible to customers",
                  value: yesNo(acc.isAccessible),
                  tone: acc.isAccessible ? "money" : "danger",
                },
                { label: "Granted by", value: orDash(acc.grantedBy) },
                {
                  label: "Blocked reasons",
                  value:
                    acc.blockedReasons.length > 0
                      ? acc.blockedReasons.join(", ")
                      : "—",
                  tone: acc.blockedReasons.length > 0 ? "danger" : "default",
                },
                { label: "Status", value: acc.facts.status },
                {
                  label: "Available budget",
                  value: formatUsd(acc.facts.availableBudgetCents),
                  tone: "money",
                },
                {
                  label: "Min visibility budget",
                  value: formatUsd(acc.facts.minVisibilityBudgetCents),
                },
                {
                  label: "Open subsidization",
                  value: yesNo(acc.facts.hasOpenSubsidizationPeriod),
                },
                {
                  label: "Subsidized shares used",
                  value: `${formatInt(acc.facts.subsidizedShareCount)} / ${formatInt(acc.facts.subsidizationShareLimit)}`,
                },
                {
                  label: "Active PAYG period",
                  value: yesNo(acc.facts.hasActivePaygPeriod),
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Advertiser"
            icon="briefcase-outline"
            tint="accent"
            summary={b.advertiser?.email ?? (b.isSubsidized ? "Subsidized" : "Unowned")}
          >
            {b.advertiser ? (
              <InfoRows
                rows={[
                  {
                    label: "Email",
                    value: b.advertiser.email,
                    onPress: () => router.push(`/advertisers/${b.advertiser?.uid}`),
                  },
                  { label: "UID", value: b.advertiser.uid },
                  { label: "Locale", value: b.advertiser.locale },
                  {
                    label: "Available budget",
                    value: formatUsd(b.advertiser.availableBudgetUsdCents),
                    tone: "money",
                  },
                  {
                    label: "Locked budget",
                    value: formatUsd(b.advertiser.lockedBudgetUsdCents),
                    tone: "money",
                  },
                  {
                    label: "Total credit purchases",
                    value: formatUsd(b.advertiser.totalCreditPurchasesUsdCents),
                    tone: "money",
                  },
                ]}
              />
            ) : (
              <InfoRows
                rows={[
                  {
                    label: "Advertiser",
                    value: b.isSubsidized ? "Subsidized by Tagly" : "Unowned",
                  },
                ]}
              />
            )}
            <AssignAdvertiserButton
              business={b}
              onDone={() => void fetchBusiness()}
            />
          </StatSection>

          <StatSection
            title="Subsidization"
            icon="sparkles-outline"
            tint="brand"
            summary={b.isSubsidized ? "Active" : "Off"}
          >
            <InfoRows
              rows={[
                { label: "Currently subsidized", value: yesNo(b.isSubsidized) },
                {
                  label: "Subsidized shares",
                  value: formatInt(b.subsidizedShareCount),
                },
                ...(b.subsidizationPeriods.length > 0
                  ? b.subsidizationPeriods.map((p, i) => ({
                      label: `Period ${i + 1}`,
                      value: `${formatDateTime(p.startedAt)} → ${p.endedAt ? formatDateTime(p.endedAt) : "open"}`,
                    }))
                  : [{ label: "Periods", value: "None" }]),
              ]}
            />
            <SubsidizeButton business={b} onDone={() => void fetchBusiness()} />
          </StatSection>

          {/* Physical QR stickers hanging in the venue — owns its own fetch */}
          <QrStickerSection businessUid={b.uid} />

          <StatSection
            title="Statistics"
            icon="stats-chart-outline"
            tint="brand"
            summary={formatInt(b.statistics.totalShares)}
          >
            <StatTile
              icon="share-social-outline"
              chip="brand"
              label="Total shares"
              value={formatInt(b.statistics.totalShares)}
            />
            <StatTile
              icon="cash-outline"
              chip="brand"
              label="Total spend"
              value={formatUsd(b.statistics.totalSpendCents)}
              tone="money"
            />
            <InfoRows
              rows={[
                {
                  label: "Avg price / share",
                  value: formatUsd(b.statistics.averagePricePerShareCents),
                  tone: "money",
                },
                {
                  label: "Unique customers",
                  value: formatInt(b.statistics.uniqueCustomers),
                },
                { label: "Total reach", value: formatInt(b.statistics.totalReach) },
              ]}
            />
            {b.statistics.totalShares > 0 ? (
              <View style={{ flexBasis: "100%" }}>
                <CustomButton
                  type="secondary"
                  label={`View all ${formatInt(b.statistics.totalShares)} shares`}
                  icon="arrow-forward"
                  iconPosition="trailing"
                  onPress={() =>
                    router.push(
                      `/shares/from/${b.uid}?title=${encodeURIComponent(b.name)}`,
                    )
                  }
                />
              </View>
            ) : null}
          </StatSection>

          <InfoRows
            rows={[
              {
                label: "Transactions",
                value: "View all",
                link: "nav",
                onPress: () =>
                  router.push(
                    `/transactions/from/${b.uid}?title=${encodeURIComponent(b.name)}`,
                  ),
              },
            ]}
          />
        </>
      ) : null}
    </DetailScaffold>
  );
}
