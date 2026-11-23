import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, callAuthed, pressFeedbackStyle, TopMenu } from "@tagly/client";
import { adminGetReviewCounts } from "@tagly/sdk/v2/adminApp";
import type { AdminReviewCountsResponse } from "@tagly/models/v2/adminApp";
import { useLogoutAction } from "@/hooks/useLogoutAction";

type Counts = AdminReviewCountsResponse["counts"];
type IconName = ComponentProps<typeof Ionicons>["name"];

const QUEUES: {
  key: keyof Counts;
  label: string;
  sublabel: string;
  icon: IconName;
  route: string;
}[] = [
  {
    key: "pendingApproval",
    label: "Review new shares",
    sublabel: "Approve or reject before they go live",
    icon: "shield-checkmark-outline",
    route: "/review/pending-approval",
  },
  {
    key: "pendingReports",
    label: "Review reported shares",
    sublabel: "Reports hold the payout until a verdict",
    icon: "flag-outline",
    route: "/review/reports",
  },
  {
    key: "unratedSubsidized",
    label: "Rate subsidized shares",
    sublabel: "Rate in the missing advertiser's stead",
    icon: "star-outline",
    route: "/review/unrated",
  },
  {
    key: "pendingLinks",
    label: "Review links",
    sublabel: "Business links stay hidden until approved",
    icon: "link-outline",
    route: "/review/links",
  },
];

/**
 * Review tab — the moderation hub. Four queue buttons, each showing its
 * outstanding count (highlighted when > 0). Counts refresh every time the tab
 * regains focus (returning from a queue screen re-syncs the numbers) and on
 * pull-to-refresh.
 */
export default function ReviewScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const logoutAction = useLogoutAction();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCounts = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) => adminGetReviewCounts({ jwt }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setCounts(res.data.counts);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void fetchCounts();
    }, [fetchCounts]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCounts();
    setRefreshing(false);
  }, [fetchCounts]);

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Review" rightAction={logoutAction} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
          gap: spacing.md,
        }}
      >
        {QUEUES.map((q) => (
          <QueueButton
            key={q.key}
            label={q.label}
            sublabel={q.sublabel}
            icon={q.icon}
            count={counts ? counts[q.key] : null}
            onPress={() => router.push(q.route as never)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function QueueButton({
  label,
  sublabel,
  icon,
  count,
  onPress,
}: {
  label: string;
  sublabel: string;
  icon: IconName;
  /** null while counts are loading. */
  count: number | null;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const hasWork = (count ?? 0) > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        { borderRadius: radius.structure, boxShadow: shadow.card },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          minHeight: layout.minTapTarget,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: color.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={color.on.accent} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={[text.bodyMedium, { color: color.ink }]}>{label}</Text>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {sublabel}
          </Text>
        </View>
        {count !== null ? (
          <View
            style={{
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.pill,
              // The count pill is the "needs attention" signal: danger when
              // the queue has work, muted surface otherwise.
              backgroundColor: hasWork ? color.dangerBg : color.background,
            }}
          >
            <Text
              style={[
                text.label,
                { color: hasWork ? color.on.dangerBg : color.text.tertiary },
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={color.text.tertiary}
        />
      </View>
    </Pressable>
  );
}
