import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomActionBar,
  BusinessTagChips,
  CustomButton,
  customAlert,
  GeneralVerticalList,
  InstagramStoryPreview,
  openInstagramStoryCamera,
  RefreshButton,
  TopMenu,
  useCooldown,
  useTheme,
  withAlpha,
} from "@tagly/client";
import { isInstagramStoryShareable } from "@tagly/models/shared";
import { useIgStories, type IgStory } from "@/hooks/useIgStories";
import { useBusiness } from "@/hooks/details/useBusiness";
import { useCustomer } from "@/contexts/Customer";
import {
  useInstagramConnection,
  useInstagramStatusLabel,
} from "@/contexts/instagram/InstagramConnectionContext";
import InstagramConnectionPrompt from "@/components/instagram/InstagramConnectionPrompt";
import { useAnalytics, type ShareCreateSource } from "@/utils/analytics";

const NUM_COLUMNS = 2;
/**
 * Client-side refresh throttle, matched to the backend's per-user stories rate
 * limit (~30s). Shared by the refresh button and pull-to-refresh so neither can
 * outrun the Instagram-backed endpoint; while it's cooling down pull-to-refresh
 * is disabled outright (not just a no-op), so the user can't keep firing requests
 * that the backend would only 429.
 */
const REFRESH_COOLDOWN_MS = 30_000;

/**
 * How long the Instagram-state spinner may run before the screen offers a
 * manual retry. A genuinely in-flight probe resolves within the SDK's 15s
 * timeout; anything longer means the state is parked (cold-start transport
 * failure) and only a retry or an app foreground cycle would unstick it.
 */
const LOADING_RETRY_AFTER_MS = 10_000;

/**
 * Share-create · step 1 — pick the Instagram story to share for a business.
 *
 * Reached from any "Earn here" CTA (business preview card, business detail,
 * map carousel), which passes the target business (`businessUid` + `businessName`).
 * v2 shares are stories-only, so this shows just the customer's live stories
 * (`GET /v2/customers/me/instagram/stories`) as a two-column grid of
 * `InstagramStoryPreview` tiles — each framed as an Instagram story (progress bar,
 * the viewer's IG avatar, posted-ago time). The screen title stays in the top bar;
 * the list header leads with the business's required tags (from `useBusiness`) — a
 * story must show at least one to validate — as accent chips, with the throttled
 * stories-refresh button alongside.
 *
 * Tapping a tile selects it (the pinned "Continue" CTA enables); the rest of the
 * flow (confirm + create) is built next.
 *
 * Gated on `instagramState`: stories can only be fetched/shared with a healthy
 * connection, so any non-CONNECTED state (NOT_LINKED / MISSING_PERMISSION /
 * DISCONNECTED / EXPIRED_TOKEN) takes over the whole screen with the
 * connect/reconnect prompt (+ incognito retry) instead of the grid.
 */
export default function CreateShareScreen() {
  const { t } = useTranslation("createShare");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {
    businessUid,
    businessName,
    source: sourceParam,
  } = useLocalSearchParams<{
    businessUid: string;
    businessName?: string;
    source?: ShareCreateSource;
  }>();
  // Name to interpolate into the copy (falls back if the param is missing).
  const businessLabel = businessName || t("thisBusiness");
  // Origin surface — "picker" for a direct entry (business card, map, detail), or
  // "opportunity_sheet" when handed off from the app-open geo-nudge. Threaded on to
  // confirm so the whole funnel is attributed to where it actually started.
  const source: ShareCreateSource = sourceParam ?? "picker";

  // Top of the share (monetization) funnel — fire once per business the picker
  // opens for.
  const { track } = useAnalytics();
  const startedTracked = useRef(false);
  useEffect(() => {
    if (businessUid && !startedTracked.current) {
      startedTracked.current = true;
      track("share_create_started", { businessUid, source });
    }
  }, [businessUid, source, track]);

  // The business detail carries the server-built `tags` (name + keywords + handle)
  // a story must show at least one of to validate — surfaced below the heading so
  // the user knows what to feature. ETag-cached, so it's usually a warm hit from
  // the business detail / preview the user came from.
  const businessQuery = useBusiness(businessUid, router, {
    enabled: !!businessUid,
  });
  const requiredTags = businessQuery.data?.tags ?? [];

  const { instagramState, resolveInstagramState } = useInstagramConnection();
  const igStatus = useInstagramStatusLabel();
  const isConnected = instagramState === "CONNECTED";

  // LOADING with no exit is a dead screen: a cold-start transport failure parks
  // `instagramState` at LOADING (deliberately — offline must not guess a state),
  // and the only automatic re-probe is an app background/foreground cycle. So
  // give the spinner a bounded lifetime here: after LOADING_RETRY_AFTER_MS,
  // surface a "taking too long — try again" affordance whose retry re-runs the
  // FULL resolve (customer + IG probe) via the connection context. `retryNonce`
  // re-arms the timer on each retry so the affordance survives repeated failures.
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  useEffect(() => {
    if (instagramState !== "LOADING") {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(
      () => setLoadingTooLong(true),
      LOADING_RETRY_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [instagramState, retryNonce]);
  const retryResolve = () => {
    setLoadingTooLong(false);
    setRetryNonce((n) => n + 1);
    void resolveInstagramState();
  };

  // The viewer's own Instagram avatar, stamped on each story tile.
  const { customer } = useCustomer();
  const pfpUrl = customer?.instagram?.pfpUrl ?? null;

  const storiesQuery = useIgStories(router, { enabled: isConnected });
  const { isLoading, isError, refetch, isRefetching } = storiesQuery;
  const stories: IgStory[] = storiesQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The pinned CTA bar overlays the list; measure it so the scroll content clears it.
  const [ctaBarHeight, setCtaBarHeight] = useState(0);

  // One cooldown shared by the refresh button + pull-to-refresh, so both throttle
  // together and stay under the backend's 30s stories rate limit. `handleRefresh`
  // is the single entry point: it no-ops while cooling down or already fetching,
  // and starts the shared cooldown the moment a refresh fires.
  const refreshCooldown = useCooldown(REFRESH_COOLDOWN_MS);
  const handleRefresh = () => {
    if (refreshCooldown.active || isRefetching) return;
    refreshCooldown.start();
    refetch();
  };

  // Two-column tile geometry. The list insets content by `screenPadding`; the gap
  // between the columns is one `spacing.md`.
  const rowWidth = width - 2 * layout.screenPadding;
  const tileWidth = (rowWidth - spacing.md) / NUM_COLUMNS;

  const renderStory = ({ item }: { item: IgStory }) => {
    const isSelected = selectedId === item.id;
    // A story whose media Instagram withholds (copyright-flagged, typically a
    // music sticker) renders as the tile's placeholder and can't be selected —
    // tapping it explains why instead (createShare would reject it with 4107).
    const shareable = isInstagramStoryShareable(item);
    return (
      <InstagramStoryPreview
        story={item}
        pfpUrl={pfpUrl}
        width={tileWidth}
        selected={isSelected}
        onPress={
          shareable
            ? () => setSelectedId(isSelected ? null : item.id)
            : () => customAlert(t("copyrightTitle"), t("copyrightMessage"))
        }
        style={{ marginBottom: spacing.md }}
      />
    );
  };

  // Header above the grid (scrolls with it). The screen title lives only in the
  // top bar now; the body leads with the required tags (a story must show at least
  // one) plus the throttled stories-refresh button. The button rides the tags-hint
  // row, with a spacer holding its place while the (independent) business fetch
  // loads, so it never shifts.
  const listHeader = (
    <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        {requiredTags.length > 0 ? (
          <Text
            style={[text.body, { color: color.text.secondary, flexShrink: 1 }]}
          >
            {t("tagsHint")}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <RefreshButton
          onPress={handleRefresh}
          loading={isRefetching}
          cooldown={refreshCooldown}
        />
      </View>

      {/* Required tags — a story must show at least one to validate. Accent
          chips, same as the business detail page; tap or hold one to copy it. */}
      <BusinessTagChips tags={requiredTags} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("title")}
        subheading={t("fromBusiness", { business: businessLabel })}
        showBack
        hideMenu
      />

      {instagramState === "LOADING" ? (
        // IG probe still resolving — don't flash the grid or the prompt. After
        // LOADING_RETRY_AFTER_MS the spinner gains copy + a retry that re-runs
        // the full resolve, so a parked state (cold-start transport failure)
        // never leaves this screen a dead spinner.
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.lg,
            paddingHorizontal: layout.screenPadding,
          }}
        >
          <ActivityIndicator color={color.text.tertiary} />
          {loadingTooLong && (
            <>
              <Text
                style={[
                  text.body,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
              >
                {t("loadingTooLong")}
              </Text>
              <CustomButton
                type="secondary"
                label={t("loadingTooLongRetry")}
                onPress={retryResolve}
              />
            </>
          )}
        </View>
      ) : !isConnected ? (
        // Not CONNECTED → the connection is the only thing to fix. A focused,
        // onboarding-style takeover (hero badge + copy, action pinned at the
        // bottom). `InstagramConnectionPrompt` owns the state-aware action label
        // (connect / fix / reconnect) + the incognito retry after a stall.
        <View
          style={{
            flex: 1,
            justifyContent: "space-between",
            paddingHorizontal: layout.screenPadding,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          {/* Hero + copy, centered in the open space above the action. */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xl,
            }}
          >
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: radius.pill,
                backgroundColor: color.brand,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: shadow.card,
              }}
            >
              <Ionicons name="logo-instagram" size={48} color={color.ink} />
            </View>

            <View style={{ gap: spacing.sm, alignItems: "center" }}>
              <Text
                style={[
                  text.title,
                  { color: color.text.primary, textAlign: "center" },
                ]}
              >
                {t("igRequiredHeading")}
              </Text>
              <Text
                style={[
                  text.body,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
              >
                {t("igRequiredBody", { business: businessLabel })}
              </Text>
            </View>
          </View>

          {/* Action block: the specific connection problem (token expired /
              disconnected / missing permission) right above the recover button. */}
          <View style={{ gap: spacing.md }}>
            {igStatus ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.xs,
                }}
              >
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={igStatus.danger ? color.danger : color.text.tertiary}
                />
                <Text
                  style={[
                    text.caption,
                    {
                      color: igStatus.danger
                        ? color.danger
                        : color.text.secondary,
                      textAlign: "center",
                    },
                  ]}
                >
                  {igStatus.text}
                </Text>
              </View>
            ) : null}
            <InstagramConnectionPrompt />
          </View>
        </View>
      ) : (
        // CONNECTED → the story grid + the pinned "Continue" CTA.
        <>
          {isLoading && stories.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={color.text.tertiary} />
            </View>
          ) : stories.length === 0 ? (
            // No live stories (or a load error) — a centered icon + copy hero,
            // mirroring the IG-connect takeover, while keeping the tags header at
            // the top and the "Continue / Upload" CTA pinned below. The refresh
            // button (in the header) is how the user re-checks after posting one.
            <View
              style={{
                flex: 1,
                paddingHorizontal: layout.screenPadding,
                paddingTop: spacing.lg,
                paddingBottom: ctaBarHeight + spacing.lg,
              }}
            >
              {listHeader}
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.xl,
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: radius.pill,
                    backgroundColor: isError
                      ? withAlpha(color.danger, 0.12)
                      : color.brand,
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: shadow.card,
                  }}
                >
                  <Ionicons
                    name={isError ? "cloud-offline-outline" : "images-outline"}
                    size={48}
                    color={isError ? color.danger : color.ink}
                  />
                </View>

                <View style={{ gap: spacing.sm, alignItems: "center" }}>
                  <Text
                    style={[
                      text.title,
                      { color: color.text.primary, textAlign: "center" },
                    ]}
                  >
                    {isError ? t("errorHeading") : t("emptyHeading")}
                  </Text>
                  <Text
                    style={[
                      text.body,
                      { color: color.text.secondary, textAlign: "center" },
                    ]}
                  >
                    {isError
                      ? t("errorSubheading")
                      : t("emptySubheading", { business: businessLabel })}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <GeneralVerticalList<IgStory>
              data={stories}
              numColumns={NUM_COLUMNS}
              renderItem={renderStory}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={listHeader}
              loading={isLoading}
              // Drop pull-to-refresh entirely while cooling down (and nothing's
              // in flight) so the list isn't even pullable — keeps it active
              // during the fetch so the spinner still shows.
              onRefresh={
                refreshCooldown.active && !isRefetching
                  ? undefined
                  : handleRefresh
              }
              refreshing={isRefetching}
              showEndText={false}
              // Clear the pinned CTA bar (+ a gap above it).
              paddingBottom={ctaBarHeight + spacing.lg}
            />
          )}

          {/* Pinned CTA bar — the bar carries the top shadow, buttons flat.
              Continue advances the picked story; the secondary opens Instagram's
              story camera for anyone who hasn't posted a story to pick yet. */}
          <BottomActionBar onHeightChange={setCtaBarHeight} gap={spacing.lg}>
            <CustomButton
              type="primary"
              label={t("continue")}
              icon="arrow-forward"
              disabled={!selectedId}
              onPress={() => {
                if (!selectedId) return;
                // Step 2: confirm + consent before monetizing the picked story.
                router.push({
                  pathname: "/shares/create/confirm",
                  params: { businessUid, businessName, storyId: selectedId, source },
                });
              }}
            />
            <CustomButton
              type="soft"
              label={t("uploadToInstagram")}
              icon="logo-instagram"
              onPress={openInstagramStoryCamera}
            />
          </BottomActionBar>
        </>
      )}
    </View>
  );
}
