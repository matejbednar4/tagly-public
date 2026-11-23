import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  callAuthed,
  CustomButton,
  HorizontalSnapList,
  SectionHeader,
  useTheme,
  withAlpha,
} from "@tagly/client";
import { getMyShares } from "@tagly/sdk/v2/customerApp";
import type { CustomerSharePreview } from "@tagly/models/v2/customerApp";
import SharePreviewCard from "./SharePreviewCard";
import SharePlaceholderCard from "./SharePlaceholderCard";

/** A strip slot: a real share, or a placeholder filler when shares run short. */
type ShareSlot =
  | { kind: "share"; share: CustomerSharePreview }
  | { kind: "placeholder"; id: string };

/**
 * Account "Your shares" section — a horizontal strip of the customer's most
 * recent shares (newest first), with "See all" → the full /shares list. Loads
 * its own slice via `GET /v2/customers/shares`. Cards tap through to /shares (a
 * dedicated share-detail route can take over later).
 *
 * Once the customer has at least one share, the row is padded out to span the
 * screen width with non-interactive `SharePlaceholderCard`s (so a couple of
 * shares don't leave a sparse, lonely row). With zero shares the whole section
 * becomes a "Get started" card — the three onboarding steps as a compact
 * timeline with a CTA into Discover — so a brand-new account reads as a nudge to
 * make the first share, not a broken empty screen. Uses the shared
 * `HorizontalSnapList` so the snap-to-next-card feel matches Discover.
 */
export default function LatestShares() {
  const { t } = useTranslation("account");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const { width } = useWindowDimensions();
  // A touch wider than a thumbnail so the footer (name + reward) reads.
  const cardSize = Math.round(width * 0.36);

  const [shares, setShares] = useState<CustomerSharePreview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await callAuthed(
        router,
        (jwt) =>
          getMyShares({ jwt, body: { offset: 0, limit: 6, sortBy: "newest" } }),
        { suppressAlerts: true },
      );
      if (!cancelled && result.ok && result.data) setShares(result.data.shares);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasShares = shares !== null && shares.length > 0;
  // Loaded and empty → the get-started card takes over this whole section (its
  // own heading), so the "Your shares" header is suppressed there.
  const isEmpty = shares !== null && shares.length === 0;

  // Once there's at least one real share, pad the row out to span the viewport
  // (card + gap each) with placeholders so it's never sparse. Zero shares is the
  // get-started card below — no placeholders there.
  const slotsToFill = Math.max(3, Math.ceil(width / (cardSize + spacing.md)));
  const realShares = shares ?? [];
  const placeholderCount = Math.max(0, slotsToFill - realShares.length);
  const slots: ShareSlot[] = [
    ...realShares.map((share): ShareSlot => ({ kind: "share", share })),
    ...Array.from(
      { length: placeholderCount },
      (_, i): ShareSlot => ({ kind: "placeholder", id: `ph_${i}` }),
    ),
  ];

  return (
    // gap.xs (not sm): the horizontal list already adds paddingVertical (so card
    // shadows aren't clipped), which doubles the header→cards gap — matches the
    // Discover shelves.
    <View style={{ gap: spacing.xs }}>
      <View style={{ marginHorizontal: layout.screenPadding }}>
        <SectionHeader
          title={isEmpty ? t("getStartedTitle") : t("sharesTitle")}
          onSeeAll={hasShares ? () => router.push("/shares") : undefined}
        />
      </View>
      {shares === null ? (
        <View
          style={{
            height: cardSize,
            justifyContent: "center",
            marginHorizontal: layout.screenPadding,
          }}
        >
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : isEmpty ? (
        <View style={{ marginHorizontal: layout.screenPadding }}>
          <GetStartedCard onFindBusiness={() => router.push("/discover")} />
        </View>
      ) : (
        <HorizontalSnapList
          data={slots}
          cardWidth={cardSize}
          keyExtractor={(slot) =>
            slot.kind === "share" ? slot.share.uid : slot.id
          }
          renderItem={(slot) =>
            slot.kind === "share" ? (
              <SharePreviewCard share={slot.share} width={cardSize} />
            ) : (
              <SharePlaceholderCard width={cardSize} />
            )
          }
        />
      )}
    </View>
  );
}

/* ── Get-started card — shown in place of the shares strip for a brand-new
   account. The three onboarding "how it works" steps (find → post → earn) as a
   horizontal timeline (icon circles joined by connectors, mirroring the account
   multiplier explainer), then a primary CTA into Discover. The step copy + icons
   ARE the onboarding steps: kicker and a `short` label are pulled straight from
   the `onboarding` namespace (`slides.<step>`), so the wording stays in lockstep
   with the onboarding carousel and there's nothing new to translate. Only the
   card chrome (lead, CTA, section title) lives in the `account` namespace. ───── */

const STEPS = [
  { icon: "storefront-outline", slide: "find", money: false },
  { icon: "camera-outline", slide: "post", money: false },
  // The "earn" step is tinted green (money = success); the rest accent blue.
  { icon: "cash-outline", slide: "earn", money: true },
] as const satisfies readonly {
  icon: keyof typeof Ionicons.glyphMap;
  slide: "find" | "post" | "earn";
  money: boolean;
}[];

function GetStartedCard({ onFindBusiness }: { onFindBusiness: () => void }) {
  const { t } = useTranslation("account");
  const { t: tOnboarding } = useTranslation("onboarding");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const CIRCLE = 44;

  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPadding,
        boxShadow: shadow.card,
        gap: spacing.lg,
      }}
    >
      <Text
        style={[
          text.caption,
          { color: color.text.secondary, textAlign: "center" },
        ]}
      >
        {t("getStartedLead")}
      </Text>

      {/* Horizontal timeline: icon circles joined by connectors. */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {STEPS.map((step, i) => (
          <Fragment key={step.slide}>
            {i > 0 ? (
              <View
                style={{
                  height: 2,
                  flex: 0.5,
                  marginTop: CIRCLE / 2 - 1, // align with circle centers
                  backgroundColor: color.border.divider,
                }}
              />
            ) : null}
            <View style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
              <View
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: radius.pill,
                  backgroundColor: color.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={step.icon} size={22} color={color.on.brand} />
              </View>
              <Text
                style={[
                  text.micro,
                  {
                    color: color.text.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {tOnboarding(`slides.${step.slide}.kicker`)}
              </Text>
              <Text
                style={[
                  text.label,
                  { color: color.text.primary, textAlign: "center" },
                ]}
                numberOfLines={2}
              >
                {tOnboarding(`slides.${step.slide}.short`)}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>

      <CustomButton
        type="primary"
        label={t("getStartedCta")}
        icon="arrow-forward"
        iconPosition="trailing"
        onPress={onFindBusiness}
      />
    </View>
  );
}
