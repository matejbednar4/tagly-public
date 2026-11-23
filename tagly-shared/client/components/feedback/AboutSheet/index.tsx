import { Linking, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { BottomSheet } from "../../overlays/BottomSheet";
import { PressableText } from "../../primitives/PressableText";
import { CustomButton } from "../../primitives/CustomButton";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { getStoreListing } from "../../../services/reviews/requestStoreReview";

/** Team contact address surfaced to users (also the About sheet's mailto). */
const CONTACT_EMAIL = "hello@taglyapp.com";

/** Tagly's public social profiles (same handles the join page links to). */
const INSTAGRAM_URL = "https://www.instagram.com/tagly_cz";
const TIKTOK_URL = "https://www.tiktok.com/@tagly.cz";

/**
 * About-Tagly sheet — reached from either app's drawer. A personal surface,
 * not a legal one: the short story of why Tagly exists, the social profiles to
 * follow, a "rate us" card that names the platform's store (App Store /
 * Google Play, via `getStoreListing()` — hidden if the host app declares no
 * store URLs), the tappable contact address, and the copyright line. Lives in
 * `@tagly/client` so both apps present the same surface; the copy is
 * audience-neutral since customers and advertisers both read it. No network,
 * no state.
 *
 * The copyright year is derived at render (`new Date().getFullYear()`) so the
 * line never goes stale; everything else is static copy from the `about`
 * namespace.
 */
export function AboutSheet({
  open,
  onClose,
  onContactPress,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Makes the contact card open the host's feedback flow (the drawers close
   * this sheet, then open `FeedbackSheet` after the exit completes — two
   * BottomSheet Modals must never be visible at once). Without it the card
   * falls back to the mailto address.
   */
  onContactPress?: () => void;
}) {
  const { t } = useTranslation("about");
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout, shadow } = theme;

  const year = new Date().getFullYear();
  const { store, url: storeUrl } = getStoreListing();

  // Emphasize one phrase inside a translated paragraph: the sentence and its
  // highlight are separate keys, split so the phrase renders in medium + ink
  // (weight-and-color emphasis — Stack Sans never goes bolder than 500).
  const withHighlight = (full: string, highlight: string) => {
    const idx = full.indexOf(highlight);
    if (idx === -1) return full;
    return (
      <>
        {full.slice(0, idx)}
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {highlight}
        </Text>
        {full.slice(idx + highlight.length)}
      </>
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.xl }}>
        {/* Title + the short personal story — one unit, kept tight. */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {withHighlight(t("story"), t("storyHighlight"))}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {withHighlight(t("storyTeam"), t("storyTeamHighlight"))}
          </Text>
        </View>

        {/* Follow along — the public profiles, side by side. */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[text.label, { color: color.text.secondary }]}>
            {t("followLabel")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <CustomButton
                type="soft"
                label="Instagram"
                icon="logo-instagram"
                onPress={() => {
                  void Linking.openURL(INSTAGRAM_URL);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CustomButton
                type="soft"
                label="TikTok"
                icon="logo-tiktok"
                onPress={() => {
                  void Linking.openURL(TIKTOK_URL);
                }}
              />
            </View>
          </View>
        </View>

        {/* Rating ask — a tappable card straight to the platform's store
            (App Store / Google Play). Only when the host app declares its
            listing URLs. */}
        {storeUrl ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(storeUrl);
            }}
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
            <Ionicons name="star-outline" size={22} color={color.ink} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {t("rateTitle")}
              </Text>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("rateBody", { store })}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={color.text.tertiary}
            />
          </Pressable>
        ) : null}

        {/* Contact — with a host-wired handler the card opens the in-app
            feedback flow; otherwise it falls back to the mailto address. */}
        {onContactPress ? (
          <Pressable
            onPress={onContactPress}
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
            <Ionicons name="chatbubble-outline" size={22} color={color.ink} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {t("contactTitle")}
              </Text>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("contactBody")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={color.text.tertiary}
            />
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
              boxShadow: shadow.card,
            }}
          >
            <Ionicons name="mail-outline" size={22} color={color.ink} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("contactLabel")}
              </Text>
              <PressableText
                style={text.bodyMedium}
                onPress={() => {
                  void Linking.openURL(`mailto:${CONTACT_EMAIL}`);
                }}
              >
                {CONTACT_EMAIL}
              </PressableText>
            </View>
          </View>
        )}

        {/* Copyright — quiet, centered, dynamic year. */}
        <Text
          style={[
            text.caption,
            { color: color.text.tertiary, textAlign: "center" },
          ]}
        >
          {t("copyright", { year })}
        </Text>
      </View>
    </BottomSheet>
  );
}
