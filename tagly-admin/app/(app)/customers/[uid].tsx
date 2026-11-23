import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  useCatalogLocalizer,
  CustomButton,
} from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import { adminGetCustomerByUid } from "@tagly/sdk/v2/adminApp";
import type { AdminCustomer } from "@tagly/models/v2/adminApp";
import type { CustomerUid } from "@tagly/models/shared";
import { StatSection, StatTile, TopList } from "@/components/statistics/StatKit";
import {
  DetailScaffold,
  InfoRows,
  orDash,
  yesNo,
  formatBpsMultiplier,
} from "@/components/details/DetailKit";
import { Badge, BadgeRow } from "@/components/entities/EntityRows";
import {
  NotificationPrefsSection,
  formatAuthIdentities,
} from "@/components/details/NotificationPrefsSection";
import {
  BanCustomerButton,
  SetMultiplierButton,
} from "@/components/details/CustomerActions";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";
import {
  openUrl,
  instagramProfileUrl,
  emailUrl,
  stripeDashboardUrl,
} from "@/utils/links";

/**
 * Customer detail — `GET /v2/admin/customers/:uid`, the full `AdminCustomer`
 * DTO laid out in collapsible sections (account, balance, instagram + latest
 * snapshot, share stats, referral, withdrawals incl. ledger trails). Reached
 * from any customer preview (list / search / share detail).
 */
export default function AdminCustomerDetailScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { interestName } = useCatalogLocalizer();

  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomer = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) =>
        adminGetCustomerByUid({ jwt, params: { uid: uid as CustomerUid } }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setCustomer(res.data.customer);
    setLoading(false);
  }, [router, uid]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  const c = customer;
  const ig = c?.instagram ?? null;
  const snap = ig?.latestSnapshot ?? null;

  return (
    <DetailScaffold
      title={c ? c.fullName || c.email : "Customer"}
      loading={loading}
      found={c != null}
    >
      {c ? (
        <>
          {/* Header — pfp, name, email, headline badges */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            {ig?.pfpUrl ? (
              <CustomMedia
                media={{ url: ig.pfpUrl, type: "IMAGE", aspectRatio: 1 }}
                style={{ width: 64, height: 64, borderRadius: radius.pill }}
                backgroundColor={color.accent}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[text.title, { color: color.ink }]} numberOfLines={2}>
                {c.fullName || c.email}
              </Text>
              <Text
                style={[
                  text.caption,
                  { color: color.ink, textDecorationLine: "underline" },
                ]}
                numberOfLines={1}
                onPress={() => openUrl(emailUrl(c.email))}
              >
                {c.email}
              </Text>
            </View>
          </View>
          <BadgeRow>
            {c.status === "BANNED" ? (
              <Badge tone="danger" label="Banned" />
            ) : (
              <Badge tone="money" label="Active" />
            )}
            <Badge tone="money" label={formatUsd(c.sensitiveData.balanceUsdCents)} />
            <Badge tone="highlight" label={formatBpsMultiplier(c.sensitiveData.multiplierBps)} />
            <Badge tone="info" label={`${formatInt(c.shareStatistics.totalShares)} shares`} />
          </BadgeRow>

          <StatSection title="Account" icon="person-outline" tint="accent" defaultOpen>
            <InfoRows
              rows={[
                { label: "UID", value: c.uid },
                {
                  label: "Status",
                  value: c.status,
                  tone: c.status === "BANNED" ? "danger" : "money",
                },
                ...(c.banReason
                  ? [{ label: "Ban reason", value: c.banReason, tone: "danger" as const }]
                  : []),
                { label: "Gender", value: c.gender },
                { label: "Locale", value: c.locale },
                { label: "Language", value: c.language },
                {
                  label: "Interests",
                  value:
                    c.interests.length > 0
                      ? c.interests.map(interestName).join(", ")
                      : "—",
                },
                { label: "Promo notifications", value: yesNo(c.promoNotificationsEnabled) },
                {
                  label: "Push tokens",
                  value:
                    c.pushTokens.activeCount > 0
                      ? `${c.pushTokens.activeCount} active (${c.pushTokens.platforms.join(", ")})`
                      : "None",
                },
                { label: "Sign-in", value: formatAuthIdentities(c.authIdentities) },
                { label: "Created", value: formatDateTime(c.createdAt) },
                { label: "Updated", value: formatDateTime(c.updatedAt) },
                { label: "Agreed to terms", value: formatDateTime(c.agreedToTermsOfServiceAt) },
                { label: "Agreed to privacy", value: formatDateTime(c.agreedToPrivacyPolicyAt) },
              ]}
            />
            <BanCustomerButton customer={c} onDone={() => void fetchCustomer()} />
          </StatSection>

          <NotificationPrefsSection prefs={c.notificationPrefs} />

          <StatSection
            title="Balance"
            icon="wallet-outline"
            tint="money"
            summary={formatUsd(c.sensitiveData.balanceUsdCents)}
            defaultOpen
          >
            <StatTile
              icon="wallet-outline"
              chip="money"
              label="Available"
              value={formatUsd(c.sensitiveData.balanceUsdCents)}
              tone="money"
            />
            <StatTile
              icon="lock-closed-outline"
              chip="money"
              label="Locked"
              value={formatUsd(c.sensitiveData.lockedBalanceUsdCents)}
              tone="money"
              hint="Reserved by in-flight withdrawals"
            />
            <InfoRows
              rows={[
                {
                  label: "Reward multiplier",
                  value: formatBpsMultiplier(c.sensitiveData.multiplierBps),
                },
                {
                  label: "Stripe Connect",
                  value: orDash(c.sensitiveData.stripeConnectId),
                  ...(c.sensitiveData.stripeConnectId
                    ? {
                        link: "external" as const,
                        onPress: () =>
                          openUrl(
                            stripeDashboardUrl(
                              "connect_account",
                              c.sensitiveData.stripeConnectId as string,
                            ),
                          ),
                      }
                    : null),
                },
                {
                  label: "Payouts enabled",
                  value: c.sensitiveData.payoutsEnabledAt
                    ? formatDateTime(c.sensitiveData.payoutsEnabledAt)
                    : "No",
                },
              ]}
            />
            <SetMultiplierButton
              customer={c}
              onDone={() => void fetchCustomer()}
            />
          </StatSection>

          <StatSection
            title="Instagram"
            icon="logo-instagram"
            tint="accent"
            summary={ig ? `@${ig.username}` : "Not connected"}
            defaultOpen={ig != null}
          >
            {ig ? (
              <>
                <InfoRows
                  rows={[
                    {
                      label: "Username",
                      value: `@${ig.username}`,
                      link: "external",
                      onPress: () => openUrl(instagramProfileUrl(ig.username)),
                    },
                    { label: "Name", value: orDash(ig.name) },
                    { label: "Instagram UID", value: ig.instagramUid },
                    { label: "Followers", value: formatInt(ig.followerCount) },
                    { label: "Account type", value: ig.accountType },
                    { label: "Connected", value: formatDateTime(ig.connectedAt) },
                  ]}
                />
                {snap ? (
                  <>
                    <InfoRows
                      rows={[
                        {
                          label: "Snapshot taken",
                          value: formatDateTime(snap.snapshotTakenAt),
                        },
                        {
                          label: "Snapshot followers",
                          value: formatInt(snap.followerCount),
                        },
                        {
                          label: "Audience source",
                          value: orDash(snap.audienceLocationsSource),
                        },
                        {
                          label: "Locations total value",
                          value: formatInt(snap.audienceLocationsTotalValue),
                        },
                        {
                          label: "Gender/age total value",
                          value: formatInt(snap.audienceGenderAgeTotalValue),
                        },
                      ]}
                    />
                    <TopList
                      title="Audience locations"
                      rows={snap.audienceLocations.map((l) => ({
                        label: l.address,
                        value: formatInt(l.value),
                      }))}
                    />
                    <TopList
                      title="Audience gender / age"
                      rows={snap.audienceGenderAges.map((g) => ({
                        label: `${g.gender} · ${g.age}`,
                        value: formatInt(g.value),
                      }))}
                    />
                  </>
                ) : (
                  <InfoRows rows={[{ label: "Latest snapshot", value: "None yet" }]} />
                )}
              </>
            ) : (
              <InfoRows rows={[{ label: "Instagram", value: "Not connected" }]} />
            )}
          </StatSection>

          <StatSection
            title="Shares"
            icon="share-social-outline"
            tint="brand"
            summary={formatInt(c.shareStatistics.totalShares)}
          >
            <StatTile
              icon="share-social-outline"
              chip="brand"
              label="Total shares"
              value={formatInt(c.shareStatistics.totalShares)}
            />
            <StatTile
              icon="checkmark-circle-outline"
              chip="brand"
              label="Paid shares"
              value={formatInt(c.shareStatistics.paidShares)}
            />
            <InfoRows
              rows={[
                {
                  label: "Total rewards",
                  value: formatUsd(c.shareStatistics.totalRewardsCents),
                  tone: "money",
                },
                {
                  label: "Avg reward / share",
                  value: formatUsd(c.shareStatistics.averageRewardPerShareCents),
                  tone: "money",
                },
                {
                  label: "Referral payouts",
                  value: formatUsd(c.shareStatistics.totalReferralPayoutsCents),
                  tone: "money",
                },
                {
                  label: "Visited places",
                  value: formatInt(c.shareStatistics.visitedPlaces),
                },
              ]}
            />
            {c.shareStatistics.totalShares > 0 ? (
              <View style={{ flexBasis: "100%" }}>
                <CustomButton
                  type="secondary"
                  label={`View all ${formatInt(c.shareStatistics.totalShares)} shares`}
                  icon="arrow-forward"
                  iconPosition="trailing"
                  onPress={() =>
                    router.push(
                      `/shares/from/${c.uid}?title=${encodeURIComponent(c.fullName || c.email)}`,
                    )
                  }
                />
              </View>
            ) : null}
          </StatSection>

          <StatSection
            title="Referral"
            icon="gift-outline"
            tint="brand"
            summary={c.referral.code}
          >
            <InfoRows
              rows={[
                { label: "Code", value: c.referral.code },
                { label: "Status", value: c.referral.status },
                {
                  label: "Referred users",
                  value: formatInt(c.referral.referredUsersCount),
                },
                {
                  label: "Referred businesses",
                  value: formatInt(c.referral.referredBusinessesCount),
                },
                c.referral.referredBy
                  ? {
                      label: "Referred by",
                      value: `${c.referral.referredBy.code} (${c.referral.referredBy.referrerType}) · ${formatDateTime(c.referral.referredBy.at)}`,
                      onPress: () => {
                        const rb = c.referral.referredBy;
                        if (!rb) return;
                        router.push(
                          rb.referrerType === "customer"
                            ? `/customers/${rb.referrerUid}`
                            : `/advertisers/${rb.referrerUid}`,
                        );
                      },
                    }
                  : { label: "Referred by", value: "Organic" },
              ]}
            />
          </StatSection>

          <InfoRows
            rows={[
              {
                label: "Transactions",
                value: "View all",
                link: "nav",
                onPress: () =>
                  router.push(
                    `/transactions/from/${c.uid}?title=${encodeURIComponent(c.fullName || c.email)}`,
                  ),
              },
            ]}
          />
        </>
      ) : null}
    </DetailScaffold>
  );
}
