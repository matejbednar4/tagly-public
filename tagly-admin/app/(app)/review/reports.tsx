import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
  StarRating,
} from "@tagly/client";
import {
  adminGetSharesPendingReport,
  adminReviewShareReport,
} from "@tagly/sdk/v2/adminApp";
import type { AdminShare } from "@tagly/models/v2/adminApp";
import {
  QueueShareCard,
  REPORT_TYPE_LABELS,
} from "@/components/review/QueueShareCard";
import { QueueScreen } from "@/components/review/QueueScreen";
import { useReviewQueue } from "@/hooks/useReviewQueue";

/**
 * Review → reported shares. A PENDING report holds the payout, so the verdict
 * decides the money: VALID → the share is never paid, the held budget goes
 * back, and the customer takes the escalating report penalty; dismiss → a
 * quality rating is required (it stands in for the advertiser's) and the
 * payout proceeds. Reports can also be filed AFTER settlement (there is no
 * reporting window and unrated shares pay at ~24h): on an already-PAID share
 * a VALID verdict moves NO money (no clawback, E047) — only the rating
 * penalty applies, and the sheet + confirm copy say so. Card media opens
 * fullscreen; the info column opens the share detail (full report + ledger
 * trail).
 */
export default function ReportsScreen() {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const router = useRouter();

  const { items, total, refreshing, onRefresh, remove } = useReviewQueue(
    useCallback(async () => {
      const res = await callAuthed(
        router,
        (jwt) => adminGetSharesPendingReport({ jwt }),
        { suppressAlerts: true },
      );
      return res.ok && res.data
        ? { items: res.data.shares, total: res.data.total }
        : null;
    }, [router]),
    (s: AdminShare) => s.uid,
  );

  // The verdict sheet's state: which share, the optional internal note, and
  // the dismiss rating (half-stars).
  const [reviewing, setReviewing] = useState<AdminShare | null>(null);
  const [note, setNote] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    (verdict: "VALID" | "DISMISSED") => {
      const share = reviewing;
      if (!share) return;
      if (verdict === "DISMISSED" && !stars) return;

      // E047: on an already-PAID share the verdict moves NO money (no
      // clawback) — the confirm copy must not claim the budget is returned.
      const alreadyPaid = share.rawStatus === "PAID";
      const [title, message, confirmLabel] =
        verdict === "VALID"
          ? alreadyPaid
            ? ([
                "Mark report valid?",
                "This share was already PAID — no money is returned. The customer's multiplier takes the report penalty and the share stops counting.",
                "Mark valid (no refund)",
              ] as const)
            : ([
                "Mark report valid?",
                "The share will never be paid, the held budget is returned, and the customer's multiplier takes the report penalty.",
                "Mark valid",
              ] as const)
          : alreadyPaid
            ? ([
                "Dismiss report?",
                "The report is dismissed and your rating is applied. The share was already paid, so nothing changes for the money.",
                "Dismiss",
              ] as const)
            : ([
                "Dismiss report?",
                "The report is dismissed, your rating is applied, and the customer gets paid normally.",
                "Dismiss",
              ] as const);

      customAlert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: confirmLabel,
          style: verdict === "VALID" ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const trimmed = note.trim();
              const res = await callAuthed(router, (jwt) =>
                adminReviewShareReport({
                  jwt,
                  params: { uid: share.uid },
                  body:
                    verdict === "VALID"
                      ? {
                          verdict: "VALID",
                          ...(trimmed ? { reviewMessage: trimmed } : {}),
                        }
                      : {
                          verdict: "DISMISSED",
                          rating: stars!,
                          ...(trimmed ? { reviewMessage: trimmed } : {}),
                        },
                }),
              );
              setBusy(false);
              if (res.ok && res.data) {
                setReviewing(null);
                setNote("");
                setStars(null);
                remove(share.uid);
              }
            })();
          },
        },
      ]);
    },
    [reviewing, stars, note, router, remove],
  );

  return (
    <>
      <QueueScreen
        title="Reported shares"
        total={total}
        loading={items === null}
        empty={items !== null && items.length === 0}
        emptyText="No reports waiting for review."
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
      >
        {(items ?? []).map((share) => (
          <QueueShareCard
            key={share.uid}
            share={share}
            showReport
            onOpenDetail={() => router.push(`/shares/${share.uid}`)}
          >
            <CustomButton
              type="soft"
              label="Review report"
              icon="hammer-outline"
              onPress={() => {
                setNote("");
                setStars(null);
                setReviewing(share);
              }}
            />
          </QueueShareCard>
        ))}
      </QueueScreen>

      <BottomSheet
        open={reviewing !== null}
        onClose={busy ? undefined : () => setReviewing(null)}
      >
        {reviewing ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[text.heading, { color: color.ink }]}>
                {REPORT_TYPE_LABELS[reviewing.report!.reportType]}
              </Text>
              {reviewing.report?.reportMessage ? (
                <Text style={[text.body, { color: color.text.secondary }]}>
                  {reviewing.report.reportMessage}
                </Text>
              ) : null}
              {/* E047: rule with eyes open — a VALID verdict on a PAID share
                  returns no money, only the rating penalty applies. */}
              {reviewing.rawStatus === "PAID" ? (
                <Text style={[text.label, { color: color.danger }]}>
                  Already paid — a valid verdict will not return the money, it
                  only lowers the customer's rating.
                </Text>
              ) : null}
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={[text.label, { color: color.text.secondary }]}>
                Rating (required to dismiss)
              </Text>
              <StarRating value={stars} onChange={setStars} size={32} />
            </View>

            <CustomTextInput
              heading="Internal note (optional)"
              placeholder="Stored on the report, not shown to users"
              value={note}
              onChangeText={setNote}
              multiline
            />

            <View style={{ gap: spacing.sm }}>
              <CustomButton
                type="soft"
                label="Dismiss report and rate"
                disabled={!stars || busy}
                loading={busy}
                onPress={() => submit("DISMISSED")}
              />
              <CustomButton
                type="destructive"
                label={
                  reviewing.rawStatus === "PAID"
                    ? "Report is valid (no refund, already paid)"
                    : "Report is valid (return money)"
                }
                disabled={busy}
                onPress={() => submit("VALID")}
              />
            </View>
          </View>
        ) : (
          <View />
        )}
      </BottomSheet>
    </>
  );
}
