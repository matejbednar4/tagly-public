import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  InteractionManager,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import {
  useTheme,
  TopMenu,
  CustomButton,
  HorizontalSnapList,
  SectionHeader,
  ZoomOnFocus,
  useNavBottomPadding,
  callAuthed,
  consumePendingStoreReview,
} from "@tagly/client";
import type { AdvertiserSharePreview } from "@tagly/models/v2/advertiserApp";
import { getUnratedShares, getMyShares } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { SharePreviewCard } from "@/components/shares/SharePreviewCard";
import { ShareAssessmentSheet } from "@/components/shares/ShareAssessmentSheet";
import { AddCreditsSheet } from "@/components/billing/AddCreditsSheet";
import { SettleBalanceSheet } from "@/components/billing/SettleBalanceSheet";
import { PaygSheet } from "@/components/billing/PaygSheet";
import { CardSheet } from "@/components/billing/CardSheet";
import { MonthlyTopUpSheet } from "@/components/billing/MonthlyTopUpSheet";
import { BudgetCard } from "@/components/billing/BudgetCard";
import { useSheetRouter } from "@/components/billing/shared/useSheetRouter";
import { NoBusinessCard } from "@/components/businesses/NoBusinessCard";

const CARD_WIDTH = 150;
// Ghost tiles pad the share strips out to full width when there are only a
// few (or no) real cards. Sized to a 9:16 story (everything is a story in v2),
// so they line up with the real preview cards' height.
const CARD_STORY_HEIGHT = Math.round(CARD_WIDTH / (9 / 16));

/** One share in a strip, or a ghost tile that pads the strip to full width. */
type StripItem =
  | { kind: "share"; share: AdvertiserSharePreview }
  | { kind: "placeholder"; id: string };

/**
 * Home tab — the "what's happening + what needs me" hub. Top to bottom:
 *   1. Account card — the reusable `BudgetCard` (status + Credits|PAYG ledger
 *      + actionable not-visible explainers; also used by the Wallet tab), or
 *      `NoBusinessCard` while there's no business page. Home owns the billing
 *      sheets the ledger cells open, and passes the "Manage wallet" footer.
 *   2. Shares to rate — the oldest unrated shares; the primary action once the
 *      account is live (rating is the main recurring job). Tapping a card, or
 *      the "rate now" CTA, opens the reusable ShareAssessmentSheet.
 *   3. Recent shares — newest shares, tap → detail; "See all" → the list.
 *      Always rendered: ghost tiles fill an empty strip, plus a "no shares
 *      yet" caption. Lifetime statistics live on the Account tab, not here.
 *
 * Budgets + visibility ride on `AdvertiserMe` (context); unrated / recent are
 * fetched screen-locally on focus (mirrors the customer Account hub).
 */
export default function HomeScreen() {
  const { t } = useTranslation("home");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const bottomPad = useNavBottomPadding();
  const { advertiser } = useAdvertiser();

  const [unrated, setUnrated] = useState<AdvertiserSharePreview[]>([]);
  const [unratedCount, setUnratedCount] = useState(0);
  const [recent, setRecent] = useState<AdvertiserSharePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState<AdvertiserSharePreview | null>(
    null,
  );
  // Same one-Modal-at-a-time rule as the wallet: "Manage card" inside the PAYG
  // sheet is a swap, not a second open.
  const {
    sheet,
    open: openSheet,
    close: closeSheet,
    swapTo,
    handleClosed,
  } = useSheetRouter<"credits" | "settle" | "payg" | "card" | "monthly">();

  // Pressing the active tab scrolls this screen back to the top (the shared
  // BottomNavigation emits `tabPress`; HorizontalSnapList self-registers so the
  // strips slide back too) — matches tagly-customer.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // Each dataset is its own cached sub-resource (like the customer Account hub):
  // fetched once on mount and re-pulled after mutating actions (funding, an
  // assessment) — NOT on every focus. `silent` suppresses error alerts.
  const loadRecent = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const res = await callAuthed(
        router,
        (jwt) =>
          getMyShares({ jwt, body: { offset: 0, limit: 8, sortBy: "newest" } }),
        { suppressAlerts: silent },
      );
      if (res.ok && res.data) setRecent(res.data.shares);
    },
    [router],
  );

  const loadUnrated = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const res = await callAuthed(router, (jwt) => getUnratedShares({ jwt }), {
        suppressAlerts: silent,
      });
      if (res.ok && res.data) {
        setUnrated(res.data.shares);
        setUnratedCount(res.data.totalUnratedCount);
      }
    },
    [router],
  );

  // Initial load — cache both datasets, then reveal the page.
  useEffect(() => {
    (async () => {
      await Promise.all([
        loadRecent({ silent: true }),
        loadUnrated({ silent: true }),
      ]);
      setLoading(false);
    })();
  }, [loadRecent, loadUnrated]);

  // An assessment removes a share from the unrated queue (or changes its state);
  // patch it into `recent` and refetch the unrated strip + count (silent).
  const onAssessed = useCallback(
    (updated: AdvertiserSharePreview) => {
      setRecent((prev) =>
        prev.map((s) => (s.uid === updated.uid ? updated : s)),
      );
      void loadUnrated({ silent: true });
      // A rating queues a store-review ask; the sheet closes over this screen
      // (no focus change), so consume here — deferred past its dismissal.
      InteractionManager.runAfterInteractions(() => {
        void consumePendingStoreReview();
      });
    },
    [loadUnrated],
  );

  // Ratings made on the shares list / share detail queue the ask too — consume
  // when home regains focus (self-throttled, no-op when nothing's queued).
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void consumePendingStoreReview();
      });
      return () => task.cancel();
    }, []),
  );

  // The strip's card routes to /shares/[uid], whose gated sheet rates the share
  // WITHOUT notifying Home — so re-pull the queue when Home regains focus, or
  // the strip keeps nagging about work already done (E046). Deliberately cheap:
  // only fires while a nag is actually showing (unratedCount > 0 — an empty
  // strip costs no request), and skips the initial mount focus (the mount
  // effect just fetched). Refs keep the focus callback stable.
  const firstFocusRef = useRef(true);
  const unratedCountRef = useRef(unratedCount);
  unratedCountRef.current = unratedCount;
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      if (unratedCountRef.current > 0) {
        void loadUnrated({ silent: true });
        void loadRecent({ silent: true });
      }
    }, [loadUnrated, loadRecent]),
  );

  // The sheets re-pull /me themselves (`useConfirmedExit`), so this only
  // refreshes what belongs to this screen.
  const onFunded = useCallback(() => {
    closeSheet();
    void loadRecent({ silent: true });
    void loadUnrated({ silent: true });
  }, [loadRecent, loadUnrated]);

  // Pad each strip with ghost tiles so a short (or empty) row still fills the
  // viewport edge to edge — fill up to the number of cards it can show.
  const perView = Math.max(
    1,
    Math.ceil((winW - layout.screenPadding * 2) / (CARD_WIDTH + spacing.md)),
  );
  const padWithPlaceholders = (
    shares: AdvertiserSharePreview[],
  ): StripItem[] => [
    ...shares.map((s) => ({ kind: "share" as const, share: s })),
    ...Array.from({ length: Math.max(0, perView - shares.length) }, (_, i) => ({
      kind: "placeholder" as const,
      id: `ph-${i}`,
    })),
  ];
  const rateItems = padWithPlaceholders(unrated);
  const recentItems = padWithPlaceholders(recent);

  return (
    <ZoomOnFocus>
      <TopMenu title={t("title")} />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="small" color={color.ink} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: layout.screenPadding,
            paddingBottom: bottomPad,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Account card — the reusable budget/visibility card, or the
              no-business prompt while there's no page (money isn't the
              blocker there, so the two cards share nothing but the spot). */}
          <View style={{ paddingHorizontal: layout.screenPadding }}>
            {advertiser && !advertiser.hasBusinessPage ? (
              <NoBusinessCard />
            ) : (
              <BudgetCard
                onPressCredits={() => openSheet("credits")}
                onPressPayg={() => openSheet("payg")}
                // Owe money (negative balance) → the footer settles it right
                // here; otherwise it's the usual jump to the Wallet tab.
                footer={
                  (advertiser?.budgets?.availableCents ?? 0) < 0
                    ? {
                        icon: "card-outline",
                        label: t("payBalance"),
                        onPress: () => openSheet("settle"),
                      }
                    : {
                        icon: "wallet-outline",
                        label: t("manageWallet"),
                        onPress: () => router.push("/wallet"),
                      }
                }
              />
            )}
          </View>

          {/* Shares to rate — each unrated card carries its own "Rate share"
              button below the preview (rating is the recurring job). */}
          {unrated.length > 0 && (
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title={t("toRate.title")}
                badge={unratedCount > 0 ? String(unratedCount) : undefined}
                style={{ paddingHorizontal: layout.screenPadding }}
              />
              <HorizontalSnapList
                data={rateItems}
                cardWidth={CARD_WIDTH}
                keyExtractor={(item) =>
                  item.kind === "share" ? item.share.uid : item.id
                }
                renderItem={(item) =>
                  item.kind === "placeholder" ? (
                    <GhostTile icon="star-outline" />
                  ) : (
                    <View style={{ width: CARD_WIDTH, gap: spacing.sm }}>
                      {/* The preview opens the detail screen; rating happens only
                          through the explicit button below it. */}
                      <SharePreviewCard
                        share={item.share}
                        width={CARD_WIDTH}
                        onPress={() => router.push(`/shares/${item.share.uid}`)}
                      />
                      <CustomButton
                        type="primary"
                        label={t("toRate.rate")}
                        icon="star-outline"
                        onPress={() => setAssessing(item.share)}
                      />
                    </View>
                  )
                }
              />
            </View>
          )}

          {/* Recent shares — always rendered: ghost tiles fill an empty strip,
              and an empty strip gets a caption explaining what will land here.
              "See all" only makes sense once there's something to list. */}
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                paddingHorizontal: layout.screenPadding,
                gap: spacing.xs,
              }}
            >
              <SectionHeader
                title={t("recent.title")}
                onSeeAll={
                  recent.length > 0 ? () => router.push("/shares") : undefined
                }
              />
              {recent.length === 0 && (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("recent.empty")}
                </Text>
              )}
            </View>
            <HorizontalSnapList
              data={recentItems}
              cardWidth={CARD_WIDTH}
              keyExtractor={(item) =>
                item.kind === "share" ? item.share.uid : item.id
              }
              renderItem={(item) =>
                item.kind === "placeholder" ? (
                  <GhostTile icon="images-outline" />
                ) : (
                  <SharePreviewCard
                    share={item.share}
                    width={CARD_WIDTH}
                    onPress={() => router.push(`/shares/${item.share.uid}`)}
                  />
                )
              }
            />
          </View>
        </ScrollView>
      )}

      <ShareAssessmentSheet
        open={assessing != null}
        share={assessing}
        onClose={() => setAssessing(null)}
        onAssessed={onAssessed}
        // 4093 (rated elsewhere, e.g. on the detail screen): drop the stale
        // card from the strip instead of letting the retry loop 409 forever.
        onConflict={() => void loadUnrated({ silent: true })}
      />
      {/* Home shows the account card, not the full funding surface (that's the
          Wallet's job), so it mounts just the sheets its ledger cells open.
          Anything about the card itself hands off to the Card sheet, exactly
          as it does inside `FundingSurface`. */}
      <AddCreditsSheet
        open={sheet === "credits"}
        onClose={() => closeSheet()}
        onClosed={handleClosed}
        onPurchased={() => {
          onFunded();
          // Same offer as the Wallet: a purchase is when the monthly top-up
          // explains itself. Only when the rule is genuinely off — a missing
          // value counts as off, since that is what a never-enabled account
          // looks like and it is exactly who this is for.
          const monthly =
            advertiser?.budgets?.monthlyBudget?.status ?? "NOT_ACTIVE";
          if (monthly === "NOT_ACTIVE") swapTo("monthly");
        }}
        surface="home"
      />
      <MonthlyTopUpSheet
        open={sheet === "monthly"}
        // The post-purchase offer is the ONLY way this sheet opens on Home (the
        // ledger cells open credits / PAYG; managing the rule lives in Wallet),
        // so it always leads with the offer's question. Gate this if a second
        // entry point is ever added here.
        afterPurchase
        onClose={() => closeSheet()}
        onEnabled={() => closeSheet()}
        onChanged={() => closeSheet()}
        onOpenCard={() => swapTo("card")}
        onClosed={handleClosed}
        surface="home"
      />
      <SettleBalanceSheet
        open={sheet === "settle"}
        onClose={() => closeSheet()}
        onSettled={onFunded}
        surface="home"
      />
      <PaygSheet
        open={sheet === "payg"}
        onClose={() => closeSheet()}
        onLinked={onFunded}
        onChanged={() => closeSheet()}
        onOpenCard={() => swapTo("card")}
        onClosed={handleClosed}
        surface="home"
      />
      <CardSheet
        open={sheet === "card"}
        onClose={() => closeSheet()}
        onChanged={() => closeSheet()}
        surface="home"
      />
    </ZoomOnFocus>
  );
}

/** A dashed ghost tile padding a share strip to full width — an empty slot at
 *  the story cards' size; not interactive. */
function GhostTile({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useTheme();
  const { color, radius } = theme;
  return (
    <View
      style={{
        width: CARD_WIDTH,
        height: CARD_STORY_HEIGHT,
        borderRadius: radius.structure,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: color.border.strong,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={22} color={color.text.tertiary} />
    </View>
  );
}
