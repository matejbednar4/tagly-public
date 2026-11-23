import { useCallback, useState } from "react";
import { ScrollView, RefreshControl, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useTheme,
  TopMenu,
  Loading,
  callAuthed,
  CustomButton,
} from "@tagly/client";
import { adminGetBlasts } from "@tagly/sdk/v2/adminApp";
import type { AdminBlast } from "@tagly/models/v2/adminApp";

/**
 * Blast history (Manage tab) — the 20 most recent blasts with live queue
 * delivery stats. Stats decay with queue retention (DONE/FAILED rows get
 * cleaned up), so older blasts show only their permanent queued count. Opens:
 * PostHog `push_opened` filtered to `admin.blast:<slug>`; email
 * delivery/bounces: the Resend dashboard's `blast` tag.
 */
export default function BlastHistoryScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [blasts, setBlasts] = useState<AdminBlast[] | null>(null);
  // A failed initial fetch must not park the screen on a forever-spinner —
  // there'd be no way to retry without leaving (the RefreshControl only exists
  // once the list rendered). Distinguish "loading" from "failed with retry".
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBlasts = useCallback(async () => {
    const res = await callAuthed(router, (jwt) => adminGetBlasts({ jwt }));
    if (res.ok && res.data) {
      setBlasts(res.data.blasts);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void fetchBlasts();
    }, [fetchBlasts]),
  );

  const onRefresh = () => {
    void (async () => {
      setRefreshing(true);
      try {
        await fetchBlasts();
      } finally {
        setRefreshing(false);
      }
    })();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Blast history" showBack hideMenu />
      {blasts === null && loadFailed ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.lg,
            paddingHorizontal: layout.screenPadding,
          }}
        >
          <Text
            style={[
              text.body,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            Couldn't load the blast history.
          </Text>
          <CustomButton
            type="secondary"
            label="Try again"
            onPress={() => {
              setLoadFailed(false);
              void fetchBlasts();
            }}
          />
        </View>
      ) : blasts === null ? (
        <Loading fullscreen />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: layout.screenPadding,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: layout.gap,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {blasts.length === 0 && (
            <Text style={[text.body, { color: color.text.secondary }]}>
              No blasts sent yet.
            </Text>
          )}
          {blasts.map((b) => (
            <View
              key={b.uid}
              style={{
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.card,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                  {b.slug ?? "(no slug)"}
                </Text>
                <Text style={[text.caption, { color: color.text.tertiary }]}>
                  {new Date(b.sentAt).toLocaleString()}
                </Text>
              </View>

              <Text style={[text.caption, { color: color.text.secondary }]}>
                {(b.audience === "EVERYONE" ? "Everyone" : "Promo opted-in") +
                  " · " +
                  b.targets.join(", ") +
                  " · " +
                  b.channels.join(" + ") +
                  " · " +
                  b.languages.join(" + ").toUpperCase() +
                  (b.senderDomain ? ` · from ${b.senderDomain}` : "")}
              </Text>

              {b.pushTitle ? (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  Push: {b.pushTitle}
                </Text>
              ) : null}
              {b.emailSubject ? (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  Email: {b.emailSubject}
                </Text>
              ) : null}

              <Text style={[text.caption, { color: color.text.primary }]}>
                {`${b.queuedCount} queued`}
                {b.stats
                  ? ` · ${b.stats.sent} sent · ${
                      b.stats.scheduled + b.stats.processing
                    } in flight · ${b.stats.failed} failed`
                  : " · queue stats expired"}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
