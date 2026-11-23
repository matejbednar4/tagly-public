import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme, callAuthed, CustomButton } from "@tagly/client";
import { adminGetAdvertiserByUid } from "@tagly/sdk/v2/adminApp";
import type { AdminAdvertiser } from "@tagly/models/v2/adminApp";
import type { AdvertiserUid } from "@tagly/models/shared";
import { StatSection, StatTile } from "@/components/statistics/StatKit";
import {
  DetailScaffold,
  InfoRows,
  orDash,
  yesNo,
} from "@/components/details/DetailKit";
import { Badge, BadgeRow, BusinessRow } from "@/components/entities/EntityRows";
import {
  NotificationPrefsSection,
  formatAuthIdentities,
} from "@/components/details/NotificationPrefsSection";
import {
  PromoCreditButton,
  CreditPurchasesSection,
} from "@/components/details/AdvertiserBilling";
import { AdvertiserReferralSection } from "@/components/details/AdvertiserReferral";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";
import { openUrl, emailUrl, stripeDashboardUrl } from "@/utils/links";

/**
 * Advertiser detail — `GET /v2/admin/advertisers/:uid`, the full
 * `AdminAdvertiser` DTO in collapsible sections (account, budget, PAYG, owned
 * businesses as clickable cards, share stats, referral, credit purchases incl.
 * ledger trails). Reached from any advertiser preview.
 */
export default function AdminAdvertiserDetailScreen() {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [advertiser, setAdvertiser] = useState<AdminAdvertiser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdvertiser = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) =>
        adminGetAdvertiserByUid({ jwt, params: { uid: uid as AdvertiserUid } }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setAdvertiser(res.data.advertiser);
    setLoading(false);
  }, [router, uid]);

  useEffect(() => {
    void fetchAdvertiser();
  }, [fetchAdvertiser]);

  const a = advertiser;

  return (
    <DetailScaffold
      title={a ? a.email : "Advertiser"}
      loading={loading}
      found={a != null}
    >
      {a ? (
        <>
          {/* Header */}
          <Text
            style={[
              text.title,
              { color: color.ink, textDecorationLine: "underline" },
            ]}
            numberOfLines={2}
            onPress={() => openUrl(emailUrl(a.email))}
          >
            {a.email}
          </Text>
          <BadgeRow>
            <Badge
              tone={a.isVisible ? "money" : "danger"}
              label={a.isVisible ? "Visible" : "Hidden"}
            />
            <Badge tone="money" label={formatUsd(a.availableBudgetUsdCents)} />
            <Badge
              tone="info"
              label={`${formatInt(a.businesses.length)} businesses`}
            />
            {a.payg.hasActivePaygPeriod ? (
              <Badge tone="highlight" label="PAYG" />
            ) : null}
            {a.monthlyBudget.active ? (
              <Badge tone="highlight" label="Monthly top-up" />
            ) : null}
          </BadgeRow>

          <StatSection
            title="Account"
            icon="briefcase-outline"
            tint="accent"
            defaultOpen
          >
            <InfoRows
              rows={[
                { label: "UID", value: a.uid },
                { label: "Entity", value: orDash(a.entity) },
                { label: "Locale", value: a.locale },
                { label: "Language", value: a.language },
                {
                  label: "Visible",
                  value: yesNo(a.isVisible),
                  tone: a.isVisible ? "money" : "danger",
                },
                {
                  label: "Promo notifications",
                  value: yesNo(a.promoNotificationsEnabled),
                },
                {
                  label: "Push tokens",
                  value:
                    a.pushTokens.activeCount > 0
                      ? `${a.pushTokens.activeCount} active (${a.pushTokens.platforms.join(", ")})`
                      : "None",
                },
                {
                  label: "Sign-in",
                  value: formatAuthIdentities(a.authIdentities),
                },
                { label: "Created", value: formatDateTime(a.createdAt) },
                { label: "Updated", value: formatDateTime(a.updatedAt) },
                {
                  label: "Agreed to terms",
                  value: formatDateTime(a.agreedToTermsOfServiceAt),
                },
                {
                  label: "Agreed to privacy",
                  value: formatDateTime(a.agreedToPrivacyPolicyAt),
                },
              ]}
            />
          </StatSection>

          <NotificationPrefsSection prefs={a.notificationPrefs} />

          <StatSection
            title="Budget"
            icon="wallet-outline"
            tint="money"
            summary={formatUsd(a.availableBudgetUsdCents)}
            defaultOpen
          >
            <StatTile
              icon="wallet-outline"
              chip="money"
              label="Available"
              value={formatUsd(a.availableBudgetUsdCents)}
              tone="money"
            />
            <StatTile
              icon="lock-closed-outline"
              chip="money"
              label="Locked"
              value={formatUsd(a.lockedBudgetUsdCents)}
              tone="money"
              hint="Reserved by in-flight shares"
            />
            <InfoRows
              rows={[
                {
                  label: "Total credit purchases",
                  value: formatUsd(a.totalCreditPurchasesUsdCents),
                  tone: "money",
                },
                {
                  label: "Stripe customer",
                  value: orDash(a.stripeCustomerId),
                  ...(a.stripeCustomerId
                    ? {
                        link: "external" as const,
                        onPress: () =>
                          openUrl(
                            stripeDashboardUrl(
                              "customer",
                              a.stripeCustomerId as string,
                            ),
                          ),
                      }
                    : null),
                },
              ]}
            />
            <PromoCreditButton
              advertiser={a}
              onDone={() => void fetchAdvertiser()}
            />
          </StatSection>

          <CreditPurchasesSection
            advertiser={a}
            onDone={() => void fetchAdvertiser()}
          />

          {/* The ONE saved off-session card, shared by PAYG + monthly budget. */}
          <StatSection
            title="Saved card"
            icon="card-outline"
            tint="money"
            summary={a.savedCard.onFile ? "On file" : "None"}
          >
            <InfoRows
              rows={[
                { label: "Card on file", value: yesNo(a.savedCard.onFile) },
                {
                  label: "Charge authorized",
                  value: a.savedCard.offSessionChargeAuthorizedAt
                    ? formatDateTime(a.savedCard.offSessionChargeAuthorizedAt)
                    : "Never",
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Pay as you go"
            icon="flash-outline"
            tint="money"
            summary={
              a.payg.hasActivePaygPeriod
                ? "Active"
                : a.payg.lastEndedReason === "CHARGE_FAILED"
                  ? "Paused (card failed)"
                  : "Off"
            }
          >
            <InfoRows
              rows={[
                {
                  label: "Active period",
                  value: yesNo(a.payg.hasActivePaygPeriod),
                },
                {
                  label: "Last period ended",
                  value: orDash(a.payg.lastEndedReason),
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Monthly top-up"
            icon="calendar-outline"
            tint="money"
            summary={
              a.monthlyBudget.active && a.monthlyBudget.targetCents != null
                ? `${formatUsd(a.monthlyBudget.targetCents)} / month`
                : a.monthlyBudget.status === "CARD_FAILED"
                  ? "Paused (card failed)"
                  : "Off"
            }
          >
            <InfoRows
              rows={[
                { label: "Status", value: a.monthlyBudget.status },
                {
                  label: "Target",
                  value:
                    a.monthlyBudget.targetCents != null
                      ? formatUsd(a.monthlyBudget.targetCents)
                      : "-",
                },
                {
                  label: "Next run",
                  value: a.monthlyBudget.nextRunAt
                    ? formatDateTime(a.monthlyBudget.nextRunAt)
                    : "-",
                },
                {
                  label: "Period since",
                  value: a.monthlyBudget.startedAt
                    ? formatDateTime(a.monthlyBudget.startedAt)
                    : "-",
                },
                {
                  label: "Charge attempts",
                  value: formatInt(a.monthlyBudget.chargeAttempts),
                },
                {
                  label: "Last failure",
                  value: orDash(a.monthlyBudget.lastFailureCode),
                },
                {
                  label: "Last period ended",
                  value: orDash(a.monthlyBudget.lastEndedReason),
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Businesses"
            icon="storefront-outline"
            tint="accent"
            summary={formatInt(a.businesses.length)}
            defaultOpen
          >
            {a.businesses.length === 0 ? (
              <InfoRows rows={[{ label: "Businesses", value: "None yet" }]} />
            ) : (
              a.businesses.map((b) => (
                <View key={b.uid} style={{ flexBasis: "100%" }}>
                  <BusinessRow
                    item={b}
                    onPress={() => router.push(`/businesses/${b.uid}`)}
                  />
                </View>
              ))
            )}
          </StatSection>

          <StatSection
            title="Shares"
            icon="share-social-outline"
            tint="brand"
            summary={formatInt(a.shareStatistics.totalShares)}
          >
            <StatTile
              icon="share-social-outline"
              chip="brand"
              label="Total shares"
              value={formatInt(a.shareStatistics.totalShares)}
            />
            <StatTile
              icon="cash-outline"
              chip="brand"
              label="Total spend"
              value={formatUsd(a.shareStatistics.totalSpendCents)}
              tone="money"
            />
            <InfoRows
              rows={[
                {
                  label: "Avg price / share",
                  value: formatUsd(a.shareStatistics.averagePricePerShareCents),
                  tone: "money",
                },
                {
                  label: "Unique customers",
                  value: formatInt(a.shareStatistics.uniqueCustomers),
                },
                {
                  label: "Total reach",
                  value: formatInt(a.shareStatistics.totalReach),
                },
              ]}
            />
            {a.shareStatistics.totalShares > 0 ? (
              <View style={{ flexBasis: "100%" }}>
                <CustomButton
                  type="secondary"
                  label={`View all ${formatInt(a.shareStatistics.totalShares)} shares`}
                  icon="arrow-forward"
                  iconPosition="trailing"
                  onPress={() =>
                    router.push(
                      `/shares/from/${a.uid}?title=${encodeURIComponent(a.email)}`,
                    )
                  }
                />
              </View>
            ) : null}
          </StatSection>

          <AdvertiserReferralSection
            advertiser={a}
            onDone={() => void fetchAdvertiser()}
          />

          <InfoRows
            rows={[
              {
                label: "Transactions",
                value: "View all",
                link: "nav",
                onPress: () =>
                  router.push(
                    `/transactions/from/${a.uid}?title=${encodeURIComponent(a.email)}`,
                  ),
              },
            ]}
          />
        </>
      ) : null}
    </DetailScaffold>
  );
}
