import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  callAuthed,
  CustomButton,
  pressFeedbackStyle,
  SectionHeader,
  showToast,
  TopMenu,
  useFormatBudget,
  useTheme,
  withAlpha,
} from "@tagly/client";
import { getAdvertiserReferrals } from "@tagly/sdk/v2/advertiserApp";
import type { AdvertiserReferrals } from "@tagly/models/v2/advertiserApp";

/**
 * Base of the public join/referral link — `https://join.taglyapp.com/<code>`.
 * Matches the customer referrals screen's constant.
 */
const JOIN_BASE_URL = "https://join.taglyapp.com";

/**
 * Referrals screen — "invite & earn", reached from the Account tab. The
 * advertiser twin of the customer referrals screen:
 *  1. Stats — lifetime referral earnings + referred businesses / users
 *     (`GET /v2/advertisers/me/referrals`).
 *  2. Invite — the advertiser's code + shareable join link (copy either; or
 *     open the native share sheet).
 *  3. How it works — the server-computed referral rates + notes.
 * No leaflet/QR (per the v2 text-cull).
 */
export default function ReferralsScreen() {
  const { t } = useTranslation("referrals");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const formatBudget = useFormatBudget();

  const [referrals, setReferrals] = useState<AdvertiserReferrals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) setRefreshing(true);
      const result = await callAuthed(
        router,
        (jwt) => getAdvertiserReferrals({ jwt }),
        { suppressAlerts: !!silent },
      );
      if (result.ok && result.data) setReferrals(result.data.referrals);
      if (!silent) setRefreshing(false);
    },
    [router],
  );
  useEffect(() => {
    load({ silent: true });
  }, [load]);

  const code = referrals?.code ?? "";
  const link = `${JOIN_BASE_URL}/${code}`;
  // Shown without the scheme — the bare host reads as a link without the noise.
  const linkLabel = `join.taglyapp.com/${code}`;

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    showToast({ type: "success", text1: t("codeCopied") });
  };
  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    showToast({ type: "success", text1: t("linkCopied") });
  };
  const shareLink = async () => {
    try {
      await Share.share({ message: t("shareMessage", { link }) });
    } catch {
      // User dismissed the share sheet — nothing to handle.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      {referrals === null ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: layout.screenPadding,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load()}
              tintColor={color.text.tertiary}
            />
          }
        >
          {/* ── Stats — earnings (money) + referred businesses / users ──────── */}
          <View
            style={{ gap: spacing.md, marginHorizontal: layout.screenPadding }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.card,
              }}
            >
              <StatChip icon="cash-outline" tone="money" />
              <View style={{ flex: 1 }}>
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("statEarnings")}
                </Text>
                <Text
                  style={[text.amount, { color: color.success }]}
                  numberOfLines={1}
                >
                  {formatBudget(referrals.totalReferralPayoutsCents)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <CountStat
                icon="business-outline"
                label={t("statBusinesses")}
                value={referrals.referredBusinessesCount}
              />
              <CountStat
                icon="people-outline"
                label={t("statUsers")}
                value={referrals.referredUsersCount}
              />
            </View>
          </View>

          {/* ── Invite — code + link, then the native share action ──────────── */}
          <View
            style={{ gap: spacing.sm, marginHorizontal: layout.screenPadding }}
          >
            <SectionHeader title={t("inviteTitle")} />
            <View
              style={{
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.card,
                gap: spacing.md,
              }}
            >
              <CopyRow label={t("yourCode")} value={code} onPress={copyCode} />
              <View
                style={{ height: 1, backgroundColor: color.border.divider }}
              />
              <CopyRow
                label={t("yourLink")}
                value={linkLabel}
                onPress={copyLink}
              />
            </View>
            <CustomButton
              type="primary"
              label={t("shareLink")}
              icon="share-social-outline"
              onPress={shareLink}
            />
          </View>

          {/* ── How it works — the referral rates (server-computed) + notes ── */}
          <HowItWorks rates={referrals.rates} />
        </ScrollView>
      )}
    </View>
  );
}

/** Tinted icon circle — `money` green for earnings, `brand` butter for the
 *  how-it-works rates, soft-blue `accent` (default) for counts. */
function StatChip({
  icon,
  tone = "accent",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "money" | "accent" | "brand";
}) {
  const { theme } = useTheme();
  const { color, radius } = theme;
  const size = 44;
  const iconColor =
    tone === "money"
      ? color.success
      : tone === "brand"
        ? color.on.brand
        : color.on.accent;
  const chip =
    tone === "money"
      ? withAlpha(color.success, 0.14)
      : tone === "brand"
        ? color.brand
        : withAlpha(color.accent, 0.55);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: chip,
      }}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
  );
}

/** One count stat — icon chip + big value over a label, in a compact card. */
function CountStat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout, shadow } = theme;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPaddingCompact,
        boxShadow: shadow.card,
      }}
    >
      <StatChip icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {value.toLocaleString()}
        </Text>
        <Text
          style={[text.caption, { color: color.text.secondary }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** A label + value row that copies the value to the clipboard on press. */
function CopyRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: layout.minTapTarget,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[text.label, { color: color.text.secondary }]}>
          {label}
        </Text>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {value}
        </Text>
      </View>
      <Ionicons name="copy-outline" size={20} color={color.text.tertiary} />
    </Pressable>
  );
}

/** bps → percent string, dropping a trailing ".0" (1600 → "16", 850 → "8.5"). */
const pctFromBps = (bps: number) => (bps / 100).toFixed(1).replace(/\.0$/, "");

/**
 * How-it-works — the two referral rates (server-computed from backend
 * economics, never hardcoded here) over a card, plus the boost-window +
 * rates-may-change notes.
 */
function HowItWorks({ rates }: { rates: AdvertiserReferrals["rates"] }) {
  const { t } = useTranslation("referrals");
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow } = theme;

  return (
    <View style={{ gap: spacing.sm, marginHorizontal: layout.screenPadding }}>
      <SectionHeader title={t("howTitle")} />
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
          gap: spacing.md,
        }}
      >
        <RateRow
          icon="business-outline"
          label={t("inviteBusiness")}
          base={t("businessBase")}
          percent={`${pctFromBps(rates.businessBps)}%`}
        />
        <View style={{ height: 1, backgroundColor: color.border.divider }} />
        <RateRow
          icon="people-outline"
          label={t("inviteFriend")}
          base={t("friendBase")}
          percent={`${pctFromBps(rates.friendBps)}%`}
        />
      </View>
      <NoteRow
        icon="time-outline"
        note={t("boostNote", { months: rates.boostDurationMonths })}
      />
      <NoteRow icon="information-circle-outline" note={t("ratesChangeNote")} />
    </View>
  );
}

/** One referral-rate row: icon chip + label / base, then the big percent. */
function RateRow({
  icon,
  label,
  base,
  percent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  base: string;
  percent: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
    >
      <StatChip icon={icon} tone="brand" />
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {label}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {base}
        </Text>
      </View>
      <Text style={[text.amount, { color: color.ink }]}>{percent}</Text>
    </View>
  );
}

/** A small supporting note — tertiary caption with a leading icon. */
function NoteRow({
  icon,
  note,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  note: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}
    >
      <Ionicons
        name={icon}
        size={14}
        color={color.text.tertiary}
        style={{ marginTop: 2 }}
      />
      <Text style={[text.caption, { color: color.text.tertiary, flex: 1 }]}>
        {note}
      </Text>
    </View>
  );
}
