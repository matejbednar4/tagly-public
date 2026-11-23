import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomSheet,
  callAuthed,
  CustomButton,
  CustomTextInput,
  openInstagramDataDeletion,
  PressableText,
  pressFeedbackStyle,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { disconnectInstagram } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import {
  useInstagramConnection,
  useInstagramStatusLabel,
} from "@/contexts/instagram/InstagramConnectionContext";
import InstagramConnectionPrompt from "@/components/instagram/InstagramConnectionPrompt";

/** Strip a leading @ + case/space, so "@Foo " and "foo" compare equal. */
const normalizeTag = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
};

/**
 * Instagram settings — the linked identity + connection health, plus reconnect
 * (broken states) and disconnect.
 *
 * State comes from `InstagramConnectionContext` (shared with the drawer/account
 * hub): the header mirrors the account hero (avatar · name · @handle · follower
 * count / "calculating" · status), `InstagramConnectionPrompt` renders the
 * connect/fix/reconnect CTA for every unhealthy state, and `useInstagramStatusLabel`
 * gives the status line.
 *
 * Disconnect is a type-to-confirm bottom sheet (you must retype your handle) so it
 * can't happen by accident: it hard-disconnects (`DELETE /v2/customers/me/instagram`
 * — voids in-flight shares, deletes the audience snapshot so it can't be inherited)
 * and drops to NOT_LINKED, from where the connect CTA lets you link a different
 * account. Paid history + media are kept. Connect errors (2214 / 4101 / 1541) are
 * mapped centrally by the context + `caller.ts`.
 */
export default function InstagramSettingsScreen() {
  const { t } = useTranslation("settingsInstagram");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow, text } = theme;
  const { customer, setCustomer } = useCustomer();
  const { setInstagramState, setIsTakingSnapshot } = useInstagramConnection();
  const statusLabel = useInstagramStatusLabel();

  const [aboutOpen, setAboutOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  if (!customer) return null;

  const ig = customer.instagram;
  const handleMatches =
    !!ig && normalizeTag(confirmText) === normalizeTag(ig.username);

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
  };

  const copyHandle = async () => {
    if (!ig) return;
    await Clipboard.setStringAsync(ig.username);
  };

  const runDisconnect = async () => {
    if (!handleMatches || disconnecting) return;
    setDisconnecting(true);
    const res = await callAuthed(router, (jwt) => disconnectInstagram({ jwt }));
    if (!res.ok) {
      setDisconnecting(false);
      return;
    }
    // Drop the account from cache + state → NOT_LINKED (the connect CTA takes
    // over, letting them link a different account).
    setCustomer((prev) => (prev ? { ...prev, instagram: null } : prev));
    setIsTakingSnapshot(false);
    setInstagramState("NOT_LINKED");
    setDisconnecting(false);
    closeConfirm();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
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
        {ig ? (
          <>
            {/* Identity — mirrors the account hero (plain on the background). */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "center",
              }}
            >
              <Avatar pfpUrl={ig.pfpUrl} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[text.title, { color: color.text.primary }]}
                  numberOfLines={1}
                >
                  {ig.name ?? `@${ig.username}`}
                </Text>
                {ig.name ? (
                  <Text
                    style={[text.caption, { color: color.text.secondary }]}
                    numberOfLines={1}
                  >
                    <Ionicons name="logo-instagram" /> @{ig.username}
                  </Text>
                ) : null}
                <Text
                  style={[text.caption, { color: color.text.tertiary }]}
                  numberOfLines={1}
                >
                  {ig.hasSnapshot
                    ? t("followers", { n: ig.followerCount.toLocaleString() })
                    : t("audienceCalculating")}
                </Text>
                {statusLabel ? (
                  <Text
                    style={[
                      text.caption,
                      {
                        color: statusLabel.danger
                          ? color.danger
                          : color.text.tertiary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    <Ionicons name="alert-circle" /> {statusLabel.text}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Fix/reconnect CTA for a broken connection (nothing when healthy). */}
            <InstagramConnectionPrompt />

            <AboutCard onPress={() => setAboutOpen(true)} />

            {/* Disconnect — destructive, behind a type-to-confirm sheet. */}
            <CustomButton
              type="destructive"
              icon="log-out-outline"
              label={t("disconnectButton")}
              onPress={() => setConfirmOpen(true)}
            />
          </>
        ) : (
          <>
            <Text style={[text.body, { color: color.text.secondary }]}>
              {t("connectPrompt")}
            </Text>
            <InstagramConnectionPrompt />
            <AboutCard onPress={() => setAboutOpen(true)} />
          </>
        )}
      </ScrollView>

      {/* About this connection — the Meta data-usage disclosure. */}
      <BottomSheet open={aboutOpen} onClose={() => setAboutOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("aboutTitle")}
        </Text>
        <Text style={[text.body, { color: color.text.secondary }]}>
          {t("aboutBody")}
        </Text>

        <View style={{ gap: spacing.sm }}>
          <Text style={[text.bodyMedium, { color: color.text.primary }]}>
            {t("aboutDoTitle")}
          </Text>
          <Bullet>{t("aboutDo1")}</Bullet>
          <Bullet>{t("aboutDo2")}</Bullet>
          <Bullet>{t("aboutDo3")}</Bullet>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={[text.bodyMedium, { color: color.text.primary }]}>
            {t("aboutNeverTitle")}
          </Text>
          <Bullet>{t("aboutNever1")}</Bullet>
          <Bullet>{t("aboutNever2")}</Bullet>
          <Bullet>{t("aboutNever3")}</Bullet>
          <Bullet>{t("aboutNever4")}</Bullet>
        </View>

        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {t("aboutSettingsNote")}
        </Text>

        <PressableText onPress={openInstagramDataDeletion}>
          {t("aboutManageData")}
        </PressableText>
      </BottomSheet>

      {/* Disconnect confirmation — retype the handle so it can't happen by accident. */}
      <BottomSheet open={confirmOpen} onClose={closeConfirm}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("confirmTitle")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("confirmBody")}
          </Text>
          {/* Tap the handle to copy it — saves retyping to confirm. */}
          {ig ? (
            <Pressable
              onPress={copyHandle}
              accessibilityRole="button"
              style={({ pressed, hovered }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: spacing.xs,
                  backgroundColor: color.surface,
                  borderRadius: radius.pill,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  boxShadow: shadow.chip,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Text style={[text.label, { color: color.text.primary }]}>
                @{ig.username}
              </Text>
              <Ionicons
                name="copy-outline"
                size={16}
                color={color.text.secondary}
              />
            </Pressable>
          ) : null}
          <CustomTextInput
            heading={t("confirmInputHeading")}
            placeholder={ig ? `@${ig.username}` : ""}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={runDisconnect}
          />
          <CustomButton
            type="destructive"
            label={t("confirmButton")}
            loading={disconnecting}
            disabled={!handleMatches}
            onPress={runDisconnect}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

/** A hanging-indent bullet row for the disclosure lists. */
function Bullet({ children }: { children: string }) {
  const { theme } = useTheme();
  const { color, spacing, text } = theme;
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Text style={[text.body, { color: color.text.tertiary }]}>{"•"}</Text>
      <Text style={[text.body, { color: color.text.secondary, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

/** "About this connection" — a pressable card row that opens the info sheet. */
function AboutCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation("settingsInstagram");
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow, text } = theme;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons
        name="shield-checkmark-outline"
        size={22}
        color={color.text.secondary}
      />
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {t("aboutButton")}
        </Text>
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {t("aboutSubtitle")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.text.tertiary} />
    </Pressable>
  );
}

/** IG profile picture, or a fallback Instagram glyph tile when there's none. */
function Avatar({ pfpUrl }: { pfpUrl: string | null }) {
  const { theme } = useTheme();
  const { color, radius, shadow } = theme;
  const SIZE = 56;
  if (pfpUrl) {
    // Shadow on a wrapping View — `boxShadow` isn't valid on RN ImageStyle.
    return (
      <View
        style={{
          borderRadius: radius.pill,
          backgroundColor: color.surface,
          boxShadow: shadow.card,
        }}
      >
        <Image
          source={{ uri: pfpUrl }}
          style={{ width: SIZE, height: SIZE, borderRadius: radius.pill }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: radius.pill,
        backgroundColor: color.surface,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: shadow.card,
      }}
    >
      <Ionicons name="logo-instagram" size={26} color={color.text.tertiary} />
    </View>
  );
}
