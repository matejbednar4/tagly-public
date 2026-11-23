import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomActionBar,
  callAuthed,
  customAlert,
  CustomButton,
  SectionHeader,
  Toggle,
  useCatalogLocalizer,
  useTheme,
} from "@tagly/client";
import {
  listNotificationSettings,
  updateNotificationPreferences,
  updateMarketingConsent,
} from "@tagly/sdk/v2/customerApp";
import type {
  NotificationCategoryWithEvents,
  SettingsNotificationChannel,
} from "@tagly/models/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * The body of a notification settings screen for one channel (PUSH or EMAIL),
 * shared by both screens. Fetches the channel's categories + events in one call
 * (`GET /me/notifications`) and groups events under localized category headers.
 *
 * Toggling is **staged, not instant**: each switch edits a local `pending` diff so
 * flipping several events fires **one** batched `POST /me/notifications/preferences`
 * on Save (a pinned `BottomActionBar` that appears only while there are unsaved
 * changes), rather than a request per tap that would hit the rate limiter. Mandatory
 * events (security / legal) render a locked "always on" row instead of a switch.
 * Copy is localized from each `slug` via the shared catalog.
 *
 * Below the per-event categories (lowest section) sits the **"Promotions &
 * reminders"** toggle — the single marketing-consent flag
 * (`promoNotificationsEnabled`) gating BOTH promo channels (email + push). It's the
 * in-app opt-out Apple Guideline 4.5.4 requires, so it renders on both the push and
 * email screens (same flag, patched into the `Customer` context on save to stay in
 * sync). Like the per-event toggles it is **staged, not instant**: it joins the same
 * Save, so one tap commits BOTH what actually changed — the batched preference
 * updates (`POST /me/notifications/preferences`) and/or the marketing flag
 * (`POST /me/update/marketing-consent`). Keeping every section on the one Save bar
 * is the point: the screen never mixes "confirm to save" sections with instant ones.
 */
export default function NotificationSettings({
  channel,
}: {
  channel: SettingsNotificationChannel;
}) {
  const { t } = useTranslation("settingsNotifications");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow, text } = theme;
  const {
    notificationCategoryName,
    notificationEventLabel,
    notificationEventDescription,
  } = useCatalogLocalizer();

  // Server truth. `pending` holds only the events whose desired state differs
  // from it (an entry that matches the server value is removed, so `pending.size`
  // is a true "unsaved changes" count).
  const [categories, setCategories] = useState<
    NotificationCategoryWithEvents[] | null
  >(null);
  const [pending, setPending] = useState<Map<number, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  const [barHeight, setBarHeight] = useState(0);

  // Marketing consent — a single top-level flag (email + push), separate from the
  // per-event prefs above. Server truth comes from the Customer context; the toggle
  // STAGES a draft that saves alongside the per-event prefs on the shared Save.
  const { customer, setCustomer } = useCustomer();
  const serverPromo = customer?.promoNotificationsEnabled ?? false;
  // null = no unsaved change; a boolean = the desired value differing from server.
  const [promoDraft, setPromoDraft] = useState<boolean | null>(null);
  const promoValue = promoDraft ?? serverPromo;
  const promoChanged = promoDraft !== null;

  // Stage the change (toggling back to the server value clears the draft) so it
  // rides the shared Save with the per-event prefs — no instant write.
  const onTogglePromo = (next: boolean) =>
    setPromoDraft(next === serverPromo ? null : next);

  useEffect(() => {
    (async () => {
      const res = await callAuthed(router, (jwt) =>
        listNotificationSettings({ jwt, query: { channel } }),
      );
      if (res.ok && res.data) setCategories(res.data.categories);
    })();
  }, [router, channel]);

  // Toggle stages the change locally; toggling back to the server value clears it.
  const onToggle = (serverEnabled: boolean, eventId: number, next: boolean) =>
    setPending((prev) => {
      const n = new Map(prev);
      if (next === serverEnabled) n.delete(eventId);
      else n.set(eventId, next);
      return n;
    });

  const save = async () => {
    if ((pending.size === 0 && !promoChanged) || saving) return;
    const updates = Array.from(pending.entries()).map(([eventId, enabled]) => ({
      eventId,
      channel,
      enabled,
    }));

    setSaving(true);
    // Fire whichever changed — both, if both did — in one Save. They're
    // independent endpoints, so run them together.
    const [prefsRes, promoRes] = await Promise.all([
      pending.size > 0
        ? callAuthed(router, (jwt) =>
            updateNotificationPreferences({ jwt, body: { updates } }),
          )
        : Promise.resolve(null),
      promoChanged
        ? callAuthed(router, (jwt) =>
            updateMarketingConsent({
              jwt,
              body: { promoNotificationsEnabled: promoDraft! },
            }),
          )
        : Promise.resolve(null),
    ]);

    // Per-event prefs: fold the applied (non-rejected) ones into server truth and
    // clear them from `pending`; keep any rejected staged. A transport failure
    // (callAuthed already alerted) leaves them staged for retry.
    let rejectedCount = 0;
    if (prefsRes?.ok && prefsRes.data) {
      const rejectedIds = new Set(prefsRes.data.rejected.map((r) => r.eventId));
      rejectedCount = prefsRes.data.rejected.length;
      setCategories(
        (prev) =>
          prev?.map((c) => ({
            ...c,
            events: c.events.map((e) =>
              pending.has(e.id) && !rejectedIds.has(e.id)
                ? { ...e, enabled: pending.get(e.id)! }
                : e,
            ),
          })) ?? prev,
      );
      setPending((prev) => {
        const next = new Map<number, boolean>();
        prev.forEach((v, k) => {
          if (rejectedIds.has(k)) next.set(k, v);
        });
        return next;
      });
    }

    // Marketing flag: patch the context (keeps push + email in sync) and clear
    // the draft on success; a failure leaves the draft for retry.
    if (promoRes?.ok && promoRes.data) {
      const committed = promoDraft!;
      setCustomer((prev) =>
        prev ? { ...prev, promoNotificationsEnabled: committed } : prev,
      );
      setPromoDraft(null);
    }

    setSaving(false);
    if (rejectedCount > 0) customAlert(t("errorTitle"), t("errorBody"));
  };

  if (!categories) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  const hasChanges = pending.size > 0 || promoChanged;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom:
            (hasChanges ? barHeight : insets.bottom) + layout.screenPadding,
          gap: spacing.xl,
        }}
      >
        {categories.length === 0 ? (
          <Text
            style={[
              text.body,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            {t("empty")}
          </Text>
        ) : null}

        {categories.map((cat) => (
          <View key={cat.slug} style={{ gap: spacing.sm }}>
            <SectionHeader title={notificationCategoryName(cat.slug)} />
            <View
              style={{
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                boxShadow: shadow.card,
                overflow: "hidden",
              }}
            >
              {cat.events.map((ev, i) => {
                const description = notificationEventDescription(ev.slug);
                const enabled = pending.has(ev.id)
                  ? pending.get(ev.id)!
                  : ev.enabled;
                return (
                  <View key={ev.id}>
                    {i > 0 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: layout.cardPadding,
                          backgroundColor: color.border.divider,
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        minHeight: 60,
                        paddingHorizontal: layout.cardPadding,
                        paddingVertical: spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            text.bodyMedium,
                            { color: color.text.primary },
                          ]}
                        >
                          {notificationEventLabel(ev.slug)}
                        </Text>
                        {description ? (
                          <Text
                            style={[
                              text.caption,
                              { color: color.text.secondary },
                            ]}
                          >
                            {description}
                          </Text>
                        ) : null}
                      </View>

                      {ev.mandatory ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: spacing.xs,
                          }}
                        >
                          <Ionicons
                            name="lock-closed"
                            size={13}
                            color={color.text.tertiary}
                          />
                          <Text
                            style={[
                              text.caption,
                              { color: color.text.tertiary },
                            ]}
                          >
                            {t("alwaysOn")}
                          </Text>
                        </View>
                      ) : (
                        <Toggle
                          value={enabled}
                          disabled={saving}
                          onValueChange={(next) =>
                            onToggle(ev.enabled, ev.id, next)
                          }
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Promotions & reminders — the single marketing-consent flag (email +
            push), written instantly. Sits below the per-event transactional prefs
            (lowest section). */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t("promoSection")} />
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              boxShadow: shadow.card,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: layout.cardPadding,
                paddingVertical: spacing.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                  {t("promoLabel")}
                </Text>
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("promoSubtitle")}
                </Text>
              </View>
              <Toggle
                value={promoValue}
                disabled={saving}
                onValueChange={onTogglePromo}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {hasChanges ? (
        <BottomActionBar onHeightChange={setBarHeight}>
          <CustomButton
            type="primary"
            label={t("save")}
            loading={saving}
            onPress={save}
          />
        </BottomActionBar>
      ) : null}
    </>
  );
}
