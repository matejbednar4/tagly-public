import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
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
} from "@tagly/client";
import { useSession } from "@/contexts/session/SessionContext";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { VisibilitySheet } from "@/components/billing/VisibilitySheet";
import { useVisibilityCause } from "@/components/billing/shared/useVisibilityCause";

/**
 * The advertiser app's drawer content, rendered inside the shared `SideDrawer`
 * (opened from the `TopMenu` menu button on every tab root) — the global
 * quick-glance + account-level utility surface, mirroring `CustomerDrawer`. Top
 * to bottom:
 *  - Glance: business identity (icon + email + member-since) from
 *    `AdvertiserMe`, then a **visibility glance** open on the cream (no card,
 *    so the nav card below is the only white surface): "Visible" (success) or a
 *    tappable "Not visible" → the `VisibilitySheet` explainer (cause from the
 *    shared `useVisibilityCause`).
 *  - Main nav: the account actions grouped on one white card with hairline
 *    dividers — Invite & earn (→ /referrals), Settings (→ /settings).
 *  - Secondary nav: the informational / help rows below a small "More" overline,
 *    demoted by weight — How it works (→ /how-it-works, the explainer-carousel
 *    guide) navigates; About pricing (`RewardInfoSheet`), Contact support
 *    (`SupportSheet`), Send feedback (`FeedbackSheet`) and About us
 *    (`AboutSheet` — the shared mission + contact + copyright surface) each
 *    close the drawer and open their bottom sheet (siblings of the drawer, so
 *    they present cleanly with it closed).
 *  - A destructive Log out pinned to the bottom.
 */
export default function AdvertiserDrawer() {
  const { t } = useTranslation("advertiserDrawer");
  const { closeDrawer } = useDrawer();
  const { signOut } = useSession();
  const { advertiser } = useAdvertiser();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  // Visibility glance: `null` while visible (or on a failed /me — fail-open),
  // else the specific not-visible cause the explainer sheet needs.
  const cause = useVisibilityCause();
  const notVisible = cause !== null;

  // Opens a sheet from a drawer row: close the drawer first so the sheet
  // presents cleanly over the closed drawer.
  const openSheet = (open: () => void) => () => {
    closeDrawer();
    open();
  };

  const navTo = (path: string) => () => {
    closeDrawer();
    router.push(path as never);
  };

  return (
    <>
      <SideDrawer>
        {/* `flexGrow: 1` lets the `flex: 1` spacer pin Log out to the bottom on
            tall screens while still scrolling on short ones. The bottom inset
            lives here (not on the panel) so the scroll surface reaches the
            bottom edge and Log out clears the home indicator. */}
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
          {/* Profile — business icon + email + member-since. */}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
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
              <Ionicons name="business" size={26} color={color.on.accent} />
            </View>
            <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
              <Text
                style={[text.bodyMedium, { color: color.text.primary }]}
                numberOfLines={1}
              >
                {advertiser?.email ?? ""}
              </Text>
              {advertiser?.createdAt ? (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("memberSince", {
                    date: dayjs(advertiser.createdAt).format(
                      dayjs.locale() === "cs" ? "M/YYYY" : "MMM YYYY",
                    ),
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Visibility glance — open on the cream (no card), so the nav card
              below is the only white surface. Visible = a calm success line;
              not visible = a tappable danger line → the explainer sheet. */}
          <View style={{ gap: spacing.xs }}>
            <Text style={[text.label, { color: color.text.secondary }]}>
              {t("visibility")}
            </Text>
            {notVisible ? (
              <Pressable
                onPress={() => setVisibilityOpen(true)}
                accessibilityRole="button"
                hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
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
                    minHeight: 28,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Ionicons
                  name="eye-off-outline"
                  size={20}
                  color={color.danger}
                />
                <Text
                  style={[text.bodyMedium, { color: color.danger, flex: 1 }]}
                >
                  {t("notVisible")}
                </Text>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={color.danger}
                />
              </Pressable>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  minHeight: 28,
                }}
              >
                <Ionicons name="eye-outline" size={20} color={color.success} />
                <Text style={[text.bodyMedium, { color: color.success }]}>
                  {t("visible")}
                </Text>
              </View>
            )}
          </View>

          {/* Nav — the account actions in one grouped white card (shadow does
              the separating), then the informational / help rows demoted below a
              small "More" overline. Wrapped together with a `spacing.lg` gap so
              they don't inherit the ScrollView's wider `spacing.xl`. */}
          <View style={{ gap: spacing.lg }}>
            {/* Main — grouped on one surface, separated by hairline dividers. */}
            <View
              style={{
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                paddingHorizontal: layout.cardPaddingCompact,
                boxShadow: shadow.card,
              }}
            >
              <DrawerRow
                icon="settings-outline"
                label={t("settings")}
                onPress={navTo("/settings")}
              />
              <DrawerRow
                icon="gift-outline"
                label={t("invite")}
                onPress={navTo("/referrals")}
                topDivider
              />
            </View>

            {/* Secondary — informational / help, demoted by weight below a small
                "More" overline. How it works navigates; the rest open a sheet. */}
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
                onPress={navTo("/how-it-works")}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="pricetag-outline"
                label={t("pricing")}
                onPress={openSheet(() => setPricingOpen(true))}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="help-circle-outline"
                label={t("support")}
                onPress={openSheet(() => setSupportOpen(true))}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="chatbubble-ellipses-outline"
                label={t("feedback")}
                onPress={openSheet(() => setFeedbackOpen(true))}
                showChevron={false}
              />
              <DrawerRow
                variant="secondary"
                icon="sparkles-outline"
                label={t("about")}
                onPress={openSheet(() => setAboutOpen(true))}
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
                    void signOut();
                  },
                },
              ])
            }
          />
        </ScrollView>
      </SideDrawer>

      {/* Sheets render their own Modal. Their opener rows close the drawer
          first, so each presents cleanly over the closed drawer. */}
      <VisibilitySheet
        open={visibilityOpen}
        onClose={() => setVisibilityOpen(false)}
        cause={cause ?? "lapsed"}
      />
      <RewardInfoSheet
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        variant="advertiser"
      />
      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="drawer"
      />
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
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
 * chevron (shown for rows that navigate, hidden for rows that open a sheet in
 * place). Two `variant`s establish hierarchy by weight, not by a box or divider
 * (mirrors the customer drawer):
 *  - `main` (default): ink icon + `bodyMedium` label — the account actions.
 *  - `secondary`: lighter tertiary icon + `label`/secondary text — the
 *    informational / help rows, demoted so they recede below the main actions.
 *
 * `topDivider` draws a hairline above the row (used inside the grouped card).
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
