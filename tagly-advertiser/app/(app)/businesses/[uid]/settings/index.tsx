import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import {
  BottomSheet,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  pressFeedbackStyle,
  showToast,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { deleteBusiness } from "@tagly/sdk/v2/advertiserApp";
import {
  SettingsSection,
  SettingsRow,
} from "@/components/settings/SettingsList";
import { BannedBusinessNotice } from "@/components/businesses/BannedBusinessNotice";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useBusiness } from "@/hooks/details/useBusiness";

/**
 * Per-business settings hub (`/businesses/:uid/settings`) — the manage surface
 * for ONE page, reached from the business detail's edit action, its "Add …"
 * prompts (which deep-link into the sections), and Settings → Business pages.
 * Three edit sections mirroring the create wizard's steps (each opens a
 * focused form reusing the shared `pageForm` step components), plus the
 * danger-zone delete.
 *
 * Delete is the two-stage removal: the page disappears everywhere immediately,
 * while in-flight shares still settle and pay (the backend purges the row
 * later). It's gated behind a **type-the-name** confirmation sheet (same
 * friction as destructive account actions) so it can't be tapped by accident.
 * After deleting we also `dismissBusinessSetup()` so an advertiser deleting
 * their only page lands back in the app (the NoBusinessCard prompt), not in the
 * setup gate.
 */
export default function BusinessSettingsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessSettings");
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow, layout } = theme;
  const queryClient = useQueryClient();
  const { refresh, dismissBusinessSetup } = useAdvertiser();

  const query = useBusiness(uid ?? "", router);
  const data = query.data;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Delete unlocks only once the typed name matches (trimmed, case-insensitive
  // — enough friction to prove intent without punishing odd casing).
  const nameConfirmed =
    !!data &&
    confirmText.trim().toLowerCase() === data.name.trim().toLowerCase();

  const openDeleteSheet = () => {
    setConfirmText("");
    setDeleteOpen(true);
  };

  // Copy the exact name so the owner can paste it into the confirm field
  // (names with odd casing/punctuation are a pain to retype).
  const copyName = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.name);
    showToast({ type: "success", text1: t("nameCopied") });
  };

  // Two gates: the sheet's type-the-name (proves intent), then a final
  // are-you-sure alert (last chance to back out) before anything fires.
  const confirmAndDelete = () => {
    if (!nameConfirmed || deleting) return;
    customAlert(t("deleteConfirmTitle"), t("deleteAlertBody"), [
      { text: t("deleteCancel"), style: "cancel" },
      {
        text: t("deleteConfirmCta"),
        style: "destructive",
        onPress: () => void runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    if (!nameConfirmed || deleting) return;
    setDeleting(true);
    const res = await callAuthed(router, (jwt) =>
      deleteBusiness({ jwt, params: { uid: uid ?? "" } }),
    );
    if (!res.ok || !res.data) {
      // Keep the sheet open so they can retry; the caller already alerted.
      setDeleting(false);
      return;
    }
    // The page is gone: drop its detail cache, refresh /me (hasBusinessPage
    // flips when this was the last page), and keep the setup gate dismissed so
    // the user isn't pushed back into onboarding.
    queryClient.removeQueries({ queryKey: ["business", uid] });
    dismissBusinessSetup();
    void refresh();
    showToast({ type: "success", text1: t("deletedToast") });
    setDeleting(false);
    setDeleteOpen(false);
    router.dismissTo("/(app)/(tabs)/account");
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack subheading={data?.name} />
      {!data ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
        >
          {/* A BANNED page is read-only (edit/delete refuse server-side) — the
              hub shows the suspended notice instead of dead rows. Reachable
              even without the detail screen's edit door via Settings →
              Business pages. */}
          {data.status === "BANNED" ? (
            <BannedBusinessNotice />
          ) : (
            <>
              <SettingsSection title={t("editSection")}>
                <SettingsRow
                  icon="storefront-outline"
                  label={t("basicsRow")}
                  subtitle={t("basicsRowSubtitle")}
                  href={`/businesses/${uid}/settings/basics`}
                />
                <SettingsRow
                  icon="images-outline"
                  label={t("mediaRow")}
                  subtitle={t("mediaRowSubtitle")}
                  href={`/businesses/${uid}/settings/media`}
                />
                <SettingsRow
                  icon="list-outline"
                  label={t("detailsRow")}
                  subtitle={t("detailsRowSubtitle")}
                  href={`/businesses/${uid}/settings/details`}
                />
              </SettingsSection>

              <SettingsSection title={t("dangerSection")}>
                <SettingsRow
                  icon="trash-outline"
                  label={t("deleteRow")}
                  subtitle={t("deleteRowSubtitle")}
                  onPress={openDeleteSheet}
                  danger
                />
              </SettingsSection>
            </>
          )}
        </ScrollView>
      )}

      {/* Type-the-name delete confirmation. Not dismissable mid-request so a
          half-fired delete can't be abandoned by dragging the sheet away. */}
      <BottomSheet
        open={deleteOpen}
        onClose={deleting ? undefined : () => setDeleteOpen(false)}
      >
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[text.title, { color: color.text.primary }]}>
              {t("deleteConfirmTitle")}
            </Text>
            <Text style={[text.body, { color: color.text.secondary }]}>
              {t("deleteConfirmBody", { name: data?.name ?? "" })}
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={[text.label, { color: color.text.primary }]}>
              {t("deleteConfirmPrompt")}
            </Text>
            {/* The exact name, tap-to-copy (also long-press selectable) so it
                can be pasted rather than retyped. */}
            <Pressable
              onPress={() => void copyName()}
              accessibilityRole="button"
              accessibilityLabel={t("copyName")}
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
                  gap: spacing.sm,
                  backgroundColor: color.surface,
                  borderRadius: radius.structure,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: layout.cardPadding,
                  boxShadow: shadow.chip,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Text
                selectable
                numberOfLines={1}
                style={[text.bodyMedium, { color: color.text.primary, flex: 1 }]}
              >
                {data?.name ?? ""}
              </Text>
              <Ionicons
                name="copy-outline"
                size={18}
                color={color.text.tertiary}
              />
            </Pressable>
            <CustomTextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={data?.name ?? ""}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <CustomButton
              type="destructive"
              label={t("deleteConfirmCta")}
              onPress={confirmAndDelete}
              disabled={!nameConfirmed}
              loading={deleting}
            />
            <CustomButton
              type="secondary"
              label={t("deleteCancel")}
              onPress={() => setDeleteOpen(false)}
              disabled={deleting}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
