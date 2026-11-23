import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
} from "@tagly/client";
import {
  adminGetSharesPendingApproval,
  adminApproveShare,
  adminRejectShare,
} from "@tagly/sdk/v2/adminApp";
import type { AdminShare } from "@tagly/models/v2/adminApp";
import { QueueShareCard } from "@/components/review/QueueShareCard";
import { QueueScreen } from "@/components/review/QueueScreen";
import { useReviewQueue } from "@/hooks/useReviewQueue";

/**
 * Review → new shares. The intake queue: every share is born PENDING and
 * hidden from the advertiser until approved here (approval places the budget
 * lock + notifies) or rejected with a customer-visible reason (mandatory
 * push+email + multiplier penalty). Both actions confirm first — they move
 * money and send messages.
 */
export default function PendingApprovalScreen() {
  const { theme } = useTheme();
  const { spacing } = theme;
  const router = useRouter();

  const { items, total, refreshing, onRefresh, remove } = useReviewQueue(
    useCallback(async () => {
      const res = await callAuthed(
        router,
        (jwt) => adminGetSharesPendingApproval({ jwt }),
        { suppressAlerts: true },
      );
      return res.ok && res.data
        ? { items: res.data.shares, total: res.data.total }
        : null;
    }, [router]),
    (s: AdminShare) => s.uid,
  );

  const [busyUid, setBusyUid] = useState<string | null>(null);
  // Reject flow: which share the reason sheet is open for.
  const [rejecting, setRejecting] = useState<AdminShare | null>(null);
  const [reason, setReason] = useState("");

  const approve = useCallback(
    (share: AdminShare) => {
      customAlert(
        "Approve share?",
        "This locks the budget, notifies the advertiser, and makes the share payable.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            onPress: () => {
              void (async () => {
                setBusyUid(share.uid);
                const res = await callAuthed(router, (jwt) =>
                  adminApproveShare({ jwt, params: { uid: share.uid } }),
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

  const submitReject = useCallback(() => {
    const share = rejecting;
    const trimmed = reason.trim();
    if (!share || !trimmed) return;
    customAlert(
      "Reject share?",
      "The customer is notified by push and email with this reason and their multiplier takes a penalty. The advertiser never sees the share.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyUid(share.uid);
              const res = await callAuthed(router, (jwt) =>
                adminRejectShare({
                  jwt,
                  params: { uid: share.uid },
                  body: { reason: trimmed },
                }),
              );
              setBusyUid(null);
              if (res.ok && res.data) {
                setRejecting(null);
                setReason("");
                remove(share.uid);
              }
            })();
          },
        },
      ],
    );
  }, [rejecting, reason, router, remove]);

  return (
    <>
      <QueueScreen
        title="New shares"
        total={total}
        loading={items === null}
        empty={items !== null && items.length === 0}
        emptyText="No shares waiting for review."
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
      >
        {(items ?? []).map((share) => (
          <QueueShareCard
            key={share.uid}
            share={share}
            onOpenDetail={() => router.push(`/shares/${share.uid}`)}
          >
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <CustomButton
                  type="soft"
                  label="Approve"
                  icon="checkmark"
                  loading={busyUid === share.uid}
                  disabled={busyUid !== null && busyUid !== share.uid}
                  onPress={() => approve(share)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <CustomButton
                  type="destructive"
                  label="Reject"
                  disabled={busyUid !== null}
                  onPress={() => {
                    setReason("");
                    setRejecting(share);
                  }}
                />
              </View>
            </View>
          </QueueShareCard>
        ))}
      </QueueScreen>

      <BottomSheet
        open={rejecting !== null}
        onClose={
          rejecting !== null && busyUid === rejecting.uid
            ? undefined
            : () => setRejecting(null)
        }
      >
        <View style={{ gap: spacing.lg }}>
          <CustomTextInput
            heading="Rejection reason"
            subheading="Sent to the customer word for word."
            placeholder="Why is this share being rejected?"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <CustomButton
            type="destructive"
            label="Reject share"
            disabled={!reason.trim() || busyUid !== null}
            loading={rejecting !== null && busyUid === rejecting.uid}
            onPress={submitReject}
          />
        </View>
      </BottomSheet>
    </>
  );
}
