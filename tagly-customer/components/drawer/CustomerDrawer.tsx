import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  AboutSheet,
  customAlert,
  CustomButton,
  FeedbackSheet,
  pressFeedbackStyle,
  RewardInfoSheet,
  SideDrawer,
  SupportSheet,
  useDrawer,
  useTheme,
  withAlpha,
} from "@tagly/client";
import { useFormatBudget } from "@tagly/client";
import { useCustomer } from "@/contexts/Customer";
import { useSession } from "@/contexts/session/SessionContext";
import { useInstagramStatusLabel } from "@/contexts/instagram/InstagramConnectionContext";
import InstagramConnectionPrompt from "@/components/instagram/InstagramConnectionPrompt";

/**
 * The customer app's drawer content, rendered inside the shared `SideDrawer`.
 * It's the global quick-glance + account-level utility surface (reachable from
 * every tab), deliberately NOT a second copy of the Account tab's activity/money
 * navigation. Top to bottom:
 *  - Glance: profile (IG avatar + name + handle + status) from `CustomerContext`;
 *    the IG connection prompt (status + connect/reconnect, self-contained in
 *    `InstagramConnectionPrompt`); then the balance as an open hero (no card) so
 *    the grouped nav card below is the only white surface (two stacked white cards
 *    would blur together).
 *  - Main nav: the three account actions — Withdraw, Settings, Invite & earn
 *    (→ /referrals) — ink-forward, grouped on one white card with hairline
 *    dividers; all navigate.
 *  - Secondary nav: the informational / help rows below a small "More" overline,
 *    demoted by weight (lighter icon + label) so they recede below the main
 *    actions — How it works (→ /how-it-works, the explainer-carousel guide)
 *    navigates; How rewards work (the `RewardInfoSheet` explainer), Help & support,
 *    Send feedback and About us (the shared `AboutSheet` — mission + contact +
 *    copyright) each close the drawer and open their bottom sheet (rendered as
 *    siblings of the drawer, so they present cleanly with it closed).
 *  - A destructive Log out.
 */
export default function CustomerDrawer() {
  const { t } = useTranslation("customerDrawer");
  const { closeDrawer } = useDrawer();
  const router = useRouter();
  const { customer } = useCustomer();
  const { signOut } = useSession();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const insets = useSafeAreaInsets();
  const formatBudget = useFormatBudget();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [rewardInfoOpen, setRewardInfoOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const ig = customer?.instagram;
  const banned = customer?.status === "BANNED";
  const balanceCents = customer?.sensitiveData.balanceUsdCents ?? 0;

  // The @handle always shows whenever an account exists (even mid-recovery); it
  // only disappears when Instagram is completely unlinked.
  const handle = ig?.username ? `@${ig.username}` : null;

  // The connection status line under the handle (danger-toned when something's
  // wrong), shared with the Account hub. The action button itself lives in
  // `InstagramConnectionPrompt`.
  const igStatus = useInstagramStatusLabel();

  return (
    <>
      <SideDrawer>
        {/* Scrolls when the content can't fit a short screen; `flexGrow: 1` keeps
            it filling the panel on tall screens so the `flex: 1` spacer still
            pins the nav + log out to the bottom. The bottom safe-area inset lives
            here (not on the drawer panel) so the scroll surface reaches the
            bottom edge and the log out button clears the home indicator. */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.xl,
          }}
        >
          {/* Profile — avatar + name + handle, then the IG connection prompt. */}
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {ig?.pfpUrl ? (
                // Shadow on a wrapping View — `boxShadow` isn't valid on RN ImageStyle.
                <View
                  style={{
                    borderRadius: radius.structure,
                    boxShadow: shadow.card,
                  }}
                >
                  <Image
                    source={{ uri: ig.pfpUrl }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radius.structure,
                    }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.structure,
                    backgroundColor: color.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: shadow.card,
                  }}
                >
                  <Ionicons name="person" size={26} color={color.on.accent} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={[text.bodyMedium, { color: color.text.primary }]}
                  numberOfLines={1}
                >
                  {customer?.fullName ?? ""}
                </Text>
                {handle ? (
                  <Text
                    style={[text.caption, { color: color.text.secondary }]}
                    numberOfLines={1}
                  >
                    <Ionicons name="logo-instagram" /> {handle}
                  </Text>
                ) : null}
                {igStatus ? (
                  <Text
                    style={[
                      text.caption,
                      {
                        color: igStatus.danger
                          ? color.danger
                          : color.text.tertiary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    <Ionicons name="alert-circle" /> {igStatus.text}
                  </Text>
                ) : null}
              </View>
            </View>

            <InstagramConnectionPrompt />

            {/* Banned indicator — mirrors the Account hub's banned state as a
              compact pill; the full explanation + Contact-support live there. */}
            {banned ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  alignSelf: "flex-start",
                  backgroundColor: withAlpha(color.danger, 0.14),
                  borderRadius: radius.pill,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Ionicons name="alert-circle" size={14} color={color.danger} />
                <Text style={[text.caption, { color: color.danger }]}>
                  {t("banned")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Money — the balance hero + the account-action nav grouped under one
            `spacing.lg` gap. Keeping the balance in this group (rather than a
            standalone child) stops the ScrollView's wider `spacing.xl` from opening
            as a hole between the balance and the card below it; the profile block
            above still gets the full `spacing.xl` section gap. */}
          <View style={{ gap: spacing.lg }}>
            {/* Balance — an open hero (no card): label + big green amount straight
              on the drawer's cream, so the grouped nav card below is the only white
              surface on the screen (two stacked white cards would blur into each
              other). Viewer's own currency only (CZK for CZ, USD for US — no dual ≈
              line; the Account hub stays the authoritative USD+≈CZK view). */}
            <View style={{ gap: spacing.xs }}>
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("balance")}
              </Text>
              <Text
                style={[
                  text.amountLg,
                  // Hug the glyph: amountLg's 44px line box leaves a descent gap
                  // below the (descender-less) digits that reads as extra bottom
                  // padding — tighten lineHeight to the font size.
                  { color: color.success, lineHeight: text.amountLg.fontSize },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatBudget(balanceCents)}
              </Text>
            </View>

            {/* Main — the three account actions, grouped on one surface and
              separated by hairline dividers (not gaps). All navigate (close the
              drawer first). Withdraw leads, pairing with the balance hero above
              (the /withdraw screen handles the set-up-payouts vs withdraw state). */}
            <View
              style={{
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                paddingHorizontal: layout.cardPaddingCompact,
                boxShadow: shadow.card,
              }}
            >
              <DrawerRow
                icon="cash-outline"
                label={t("withdraw")}
                onPress={() => {
                  closeDrawer();
                  router.push("/withdraw");
                }}
              />
              <DrawerRow
                icon="settings-outline"
                label={t("settings")}
                topDivider
                onPress={() => {
                  closeDrawer();
                  router.push("/settings");
                }}
              />
              <DrawerRow
                icon="gift-outline"
                label={t("invite")}
                topDivider
                onPress={() => {
                  closeDrawer();
                  router.push("/referrals");
                }}
              />
            </View>

            {/* Secondary — informational / help, demoted by weight (lighter icon
              + `label` text, no chevron) below a small "More" overline. The tight
              `spacing.xs` group gap keeps the overline close to its rows. How it
              works navigates; the rest close the drawer and open their sheet. */}
            <View style={{ gap: spacing.xs }}>
              <Text
                style={[
                  text.micro,
                  {
                    color: color.text.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: 0.9,
                    paddingLeft: spacing.xs,
                  },
                ]}
              >
                {t("more")}
              </Text>
              <DrawerRow
                variant="secondary"
                icon="information-circle-outline"
                label={t("howItWorks")}
                onPress={() => {
                  closeDrawer();
                  router.push("/how-it-works");
                }}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="calculator-outline"
                label={t("rewards")}
                onPress={() => {
                  closeDrawer();
                  setRewardInfoOpen(true);
                }}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="help-circle-outline"
                label={t("support")}
                onPress={() => {
                  closeDrawer();
                  setSupportOpen(true);
                }}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="chatbubble-ellipses-outline"
                label={t("feedback")}
                onPress={() => {
                  closeDrawer();
                  setFeedbackOpen(true);
                }}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="sparkles-outline"
                label={t("about")}
                onPress={() => {
                  closeDrawer();
                  setAboutOpen(true);
                }}
                showChevron={false}
              />
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <CustomButton
            type="destructive"
            label={t("logOut")}
            onPress={() =>
              customAlert(t("logOutConfirmTitle"), t("logOutConfirmBody"), [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("logOut"),
                  style: "destructive",
                  onPress: () => {
                    closeDrawer();
                    signOut();
                  },
                },
              ])
            }
          />
        </ScrollView>
      </SideDrawer>

      {/* Sheets render their own Modal → float above the drawer; dismissing them
          returns to the still-open drawer. */}
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="drawer"
      />
      <RewardInfoSheet
        open={rewardInfoOpen}
        onClose={() => setRewardInfoOpen(false)}
      />
      <AboutSheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onContactPress={() => {
          // Close About first, then open Feedback once the exit is done (two
          // BottomSheet Modals must never be visible at once — exit animation
          // ~200ms, unmount watchdog 400ms).
          setAboutOpen(false);
          setTimeout(() => setFeedbackOpen(true), 450);
        }}
      />
    </>
  );
}

/**
 * One utility-nav row in the drawer: an icon + label, with an optional forward
 * chevron (shown for rows that navigate to a screen, hidden for rows that open a
 * sheet in place). Hits the shared press feedback + min tap target.
 *
 * Two `variant`s establish hierarchy by weight, not by a box or divider:
 *  - `main` (default): ink icon + `bodyMedium` primary label — the account
 *    actions the drawer exists for (Withdraw, Settings, Invite).
 *  - `secondary`: lighter tertiary icon + `label`/secondary-text — the
 *    informational / help rows, demoted so they recede below the main actions.
 *
 * `topDivider` draws a hairline above the row — used to separate the main rows
 * inside the grouped card (the card owns the elevation; dividers own the splits).
 */
function DrawerRow({
  icon,
  label,
  onPress,
  showChevron = true,
  variant = "main",
  topDivider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  variant?: "main" | "secondary";
  topDivider?: boolean;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const secondary = variant === "secondary";
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
          // Main rows (the grouped-card actions) sit a touch taller than the
          // 44 tap-target floor for a more comfortable primary list; secondary
          // rows stay compact at the minimum.
          minHeight: secondary
            ? layout.minTapTarget
            : layout.minTapTarget + spacing.sm,
          ...(topDivider
            ? { borderTopWidth: 1, borderTopColor: color.border.divider }
            : null),
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons
        name={icon}
        size={secondary ? 20 : 22}
        color={secondary ? color.text.tertiary : color.ink}
      />
      <Text
        style={[
          secondary ? text.label : text.bodyMedium,
          {
            color: secondary ? color.text.secondary : color.text.primary,
            flex: 1,
          },
        ]}
      >
        {label}
      </Text>
      {showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={color.text.tertiary}
        />
      ) : null}
    </Pressable>
  );
}
