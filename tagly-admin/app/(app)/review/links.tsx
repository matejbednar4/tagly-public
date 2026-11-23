import { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useTheme,
  callAuthed,
  customAlert,
  pressFeedbackStyle,
  CustomButton,
} from "@tagly/client";
import {
  adminGetPendingLinks,
  adminReviewLink,
} from "@tagly/sdk/v2/adminApp";
import type { AdminPendingLink } from "@tagly/models/v2/adminApp";
import { QueueScreen } from "@/components/review/QueueScreen";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { openUrl } from "@/utils/links";
import { formatDateTime } from "@/utils/format";

/**
 * Review → links. Business website/reservation/menu links stay hidden from
 * customers until approved here — approval puts the URL live on every
 * business referencing it; rejection is a global kill-switch (the shared Link
 * row hides the URL everywhere, and future submissions of the same URL
 * inherit the rejection). ALWAYS open and inspect the URL before approving.
 */
export default function LinksScreen() {
  const router = useRouter();

  const { items, total, refreshing, onRefresh, remove } = useReviewQueue(
    useCallback(async () => {
      const res = await callAuthed(
        router,
        (jwt) => adminGetPendingLinks({ jwt }),
        { suppressAlerts: true },
      );
      return res.ok && res.data
        ? { items: res.data.links, total: res.data.total }
        : null;
    }, [router]),
    (l: AdminPendingLink) => String(l.id),
  );

  const [busyId, setBusyId] = useState<number | null>(null);

  const review = useCallback(
    (link: AdminPendingLink, status: "APPROVED" | "REJECTED") => {
      const [title, message, confirmLabel, style] =
        status === "APPROVED"
          ? ([
              "Approve link?",
              "The link goes live for customers on every business using it.",
              "Approve",
              "default",
            ] as const)
          : ([
              "Reject link?",
              "The link stays hidden everywhere, and any business entering this URL in the future inherits the rejection.",
              "Reject",
              "destructive",
            ] as const);

      customAlert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: confirmLabel,
          style,
          onPress: () => {
            void (async () => {
              setBusyId(link.id);
              const res = await callAuthed(router, (jwt) =>
                adminReviewLink({
                  jwt,
                  params: { id: link.id },
                  body: { status },
                }),
              );
              setBusyId(null);
              if (res.ok && res.data) remove(String(link.id));
            })();
          },
        },
      ]);
    },
    [router, remove],
  );

  return (
    <QueueScreen
      title="Links"
      total={total}
      loading={items === null}
      empty={items !== null && items.length === 0}
      emptyText="No links waiting for review."
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      {(items ?? []).map((link) => (
        <LinkCard
          key={link.id}
          link={link}
          busy={busyId === link.id}
          disabled={busyId !== null}
          onOpenBusiness={(uid) => router.push(`/businesses/${uid}`)}
          onReview={(status) => review(link, status)}
        />
      ))}
    </QueueScreen>
  );
}

function LinkCard({
  link,
  busy,
  disabled,
  onOpenBusiness,
  onReview,
}: {
  link: AdminPendingLink;
  busy: boolean;
  disabled: boolean;
  onOpenBusiness: (uid: string) => void;
  onReview: (status: "APPROVED" | "REJECTED") => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;

  return (
    <View style={{ borderRadius: radius.structure, boxShadow: shadow.card }}>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          gap: spacing.sm,
        }}
      >
        {/* The URL — opens externally so the reviewer can inspect the page. */}
        <Pressable
          onPress={() => openUrl(link.url)}
          style={({ pressed, hovered }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              minHeight: layout.minTapTarget,
            },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <Text
            style={[
              text.bodyMedium,
              {
                color: color.ink,
                textDecorationLine: "underline",
                flexShrink: 1,
              },
            ]}
          >
            {link.url}
          </Text>
          <Ionicons name="open-outline" size={16} color={color.text.tertiary} />
        </Pressable>

        <Text style={[text.micro, { color: color.text.tertiary }]}>
          {`Submitted ${formatDateTime(link.createdAt)}`}
        </Text>

        {/* Where the link is used (business name + which slots). */}
        {link.businesses.length === 0 ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            Not referenced by any business anymore.
          </Text>
        ) : (
          link.businesses.map((b) => (
            <Pressable
              key={b.uid}
              onPress={() => onOpenBusiness(b.uid)}
              style={({ pressed, hovered }) => [
                { flexDirection: "row", alignItems: "center", gap: spacing.xs },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Text style={[text.caption, { color: color.ink }]}>{b.name}</Text>
              <Text style={[text.caption, { color: color.text.tertiary }]}>
                {b.slots.join(" · ")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={color.text.tertiary}
              />
            </Pressable>
          ))
        )}

        <View
          style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}
        >
          <View style={{ flex: 1 }}>
            <CustomButton
              type="soft"
              label="Approve"
              icon="checkmark"
              loading={busy}
              disabled={disabled && !busy}
              onPress={() => onReview("APPROVED")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CustomButton
              type="destructive"
              label="Reject"
              disabled={disabled}
              onPress={() => onReview("REJECTED")}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
