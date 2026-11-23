import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useTheme,
  callAuthed,
  customAlert,
  pressFeedbackStyle,
  CustomButton,
  CustomTextInput,
  BottomSheet,
  StarRating,
} from "@tagly/client";
import {
  adminGetUnratedShares,
  adminAssessShare,
} from "@tagly/sdk/v2/adminApp";
import type { AdminShare } from "@tagly/models/v2/adminApp";
import type { ReportType } from "@tagly/models/shared";
import { ReportTypeValues } from "@tagly/models/shared";
import {
  QueueShareCard,
  REPORT_TYPE_LABELS,
} from "@/components/review/QueueShareCard";
import { QueueScreen } from "@/components/review/QueueScreen";
import { useReviewQueue } from "@/hooks/useReviewQueue";

/**
 * Review → rate subsidized shares. Subsidized businesses have no advertiser,
 * so admins rate their APPROVED shares in that role — same once-only
 * half-star assessment the advertiser makes, feeding the customer's rolling
 * multiplier. A share can instead be reported (files a PENDING report that
 * lands in the reported-shares queue).
 */
export default function UnratedScreen() {
  const { theme } = useTheme();
  const { spacing } = theme;
  const router = useRouter();

  const { items, total, refreshing, onRefresh, remove } = useReviewQueue(
    useCallback(async () => {
      const res = await callAuthed(
        router,
        (jwt) => adminGetUnratedShares({ jwt }),
        { suppressAlerts: true },
      );
      return res.ok && res.data
        ? { items: res.data.shares, total: res.data.total }
        : null;
    }, [router]),
    (s: AdminShare) => s.uid,
  );

  const [busyUid, setBusyUid] = useState<string | null>(null);
  // Report flow: which share the report sheet is open for.
  const [reporting, setReporting] = useState<AdminShare | null>(null);

  const rate = useCallback(
    (share: AdminShare, stars: number) => {
      customAlert(
        `Rate ${stars / 2} stars?`,
        "The rating is final and adjusts the customer's reward multiplier.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Rate",
            onPress: () => {
              void (async () => {
                setBusyUid(share.uid);
                const res = await callAuthed(router, (jwt) =>
                  adminAssessShare({
                    jwt,
                    params: { uid: share.uid },
                    body: { kind: "RATING", rating: stars },
                  }),
                );
                setBusyUid(null);
                if (res.ok && res.data) remove(share.uid);
              })();
            },
          },
        ],
      );
    },
    [router, remove],
  );

  const report = useCallback(
    (share: AdminShare, reportType: ReportType, message: string) => {
      customAlert(
        "Report share?",
        "Files a report for review; the payout is held until a verdict.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Report",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setBusyUid(share.uid);
                const res = await callAuthed(router, (jwt) =>
                  adminAssessShare({
                    jwt,
                    params: { uid: share.uid },
                    body: {
                      kind: "REPORT",
                      reportType,
                      ...(message.trim()
                        ? { reportMessage: message.trim() }
                        : {}),
                    },
                  }),
                );
                setBusyUid(null);
                if (res.ok && res.data) {
                  setReporting(null);
                  remove(share.uid);
                }
              })();
            },
          },
        ],
      );
    },
    [router, remove],
  );

  return (
    <>
      <QueueScreen
        title="Rate subsidized"
        total={total}
        loading={items === null}
        empty={items !== null && items.length === 0}
        emptyText="No subsidized shares waiting for a rating."
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
      >
        {(items ?? []).map((share) => (
          <UnratedCard
            key={share.uid}
            share={share}
            busy={busyUid === share.uid}
            disabled={busyUid !== null}
            onOpenDetail={() => router.push(`/shares/${share.uid}`)}
            onRate={(stars) => rate(share, stars)}
            onReport={() => setReporting(share)}
          />
        ))}
      </QueueScreen>

      <ReportSheet
        share={reporting}
        busy={reporting !== null && busyUid === reporting.uid}
        onClose={() => setReporting(null)}
        onSubmit={report}
      />
    </>
  );
}

/** One unrated share: inline star input + rate/report actions. */
function UnratedCard({
  share,
  busy,
  disabled,
  onOpenDetail,
  onRate,
  onReport,
}: {
  share: AdminShare;
  busy: boolean;
  disabled: boolean;
  onOpenDetail: () => void;
  onRate: (stars: number) => void;
  onReport: () => void;
}) {
  const { theme } = useTheme();
  const { spacing } = theme;
  const [stars, setStars] = useState<number | null>(null);

  return (
    <QueueShareCard share={share} onOpenDetail={onOpenDetail}>
      <View style={{ alignItems: "center" }}>
        <StarRating value={stars} onChange={setStars} size={32} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <CustomButton
            type="soft"
            label="Rate"
            icon="star"
            loading={busy}
            disabled={!stars || disabled}
            onPress={() => stars && onRate(stars)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CustomButton
            type="secondary"
            label="Report"
            icon="flag-outline"
            disabled={disabled}
            onPress={onReport}
          />
        </View>
      </View>
    </QueueShareCard>
  );
}

/** Report sheet: reason picker (radio rows) + optional message. */
function ReportSheet({
  share,
  busy,
  onClose,
  onSubmit,
}: {
  share: AdminShare | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (share: AdminShare, reportType: ReportType, message: string) => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const [reportType, setReportType] = useState<ReportType>(
    "VIOLATES_GUIDELINES",
  );
  const [message, setMessage] = useState("");

  // The sheet is always mounted — reset the form whenever it opens for a share
  // so a previous report's reason/message never leaks onto the next one.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (share && openedFor.current !== share.uid) {
      openedFor.current = share.uid;
      setReportType("VIOLATES_GUIDELINES");
      setMessage("");
    }
    if (!share) openedFor.current = null;
  }, [share]);

  return (
    <BottomSheet open={share !== null} onClose={busy ? undefined : onClose}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          {ReportTypeValues.map((value) => {
            const active = reportType === value;
            return (
              <Pressable
                key={value}
                onPress={() => setReportType(value)}
                style={({ pressed, hovered }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.structure,
                    backgroundColor: active ? color.ink : color.surface,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={active ? color.on.ink : color.text.tertiary}
                />
                <Text
                  style={[
                    text.label,
                    { color: active ? color.on.ink : color.ink },
                  ]}
                >
                  {REPORT_TYPE_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <CustomTextInput
          heading="Details (optional)"
          placeholder="What's wrong with this share?"
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <CustomButton
          type="destructive"
          label="File report"
          loading={busy}
          disabled={busy}
          onPress={() => share && onSubmit(share, reportType, message)}
        />
      </View>
    </BottomSheet>
  );
}
