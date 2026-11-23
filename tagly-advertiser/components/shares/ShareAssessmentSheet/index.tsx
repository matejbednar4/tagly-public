import { useEffect, useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  useTheme,
  BottomSheet,
  CustomButton,
  CustomTextInput,
  CustomPicker,
  callAuthed,
  customAlert,
  pressFeedbackStyle,
  queueStoreReview,
} from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import { ReportTypeValues, type ReportType } from "@tagly/models/shared";
import type { AdvertiserSharePreview } from "@tagly/models/v2/advertiserApp";
import { submitShareAssessment } from "@tagly/sdk/v2/advertiserApp";
import { StarRating } from "@tagly/client";

// The media leads the sheet — it's the whole thing being judged. Keep its real
// aspect ratio, filling the sheet width, but cap the height so the stars + CTA
// still sit above the fold on a tall (9:16) post.
const clampAspectRatio = (ar: number) => Math.min(Math.max(ar, 0.5), 1.5);

type Mode = "RATE" | "REPORT";

/**
 * The reusable rate / report bottom sheet — mounted by any surface that shows an
 * advertiser share (home "shares to rate" strip, shares list, share detail).
 * Parent owns `open` + which `share` is being assessed and swaps in the returned
 * share via `onAssessed`.
 *
 * Rating and reporting are the two mutually-exclusive outcomes of one action
 * (one endpoint — `submitShareAssessment`). The sheet shows ONLY the post (media,
 * business, type) — never insights or price — because the advertiser rates post
 * QUALITY as a signal of the sharer's future quality (see docs/SHARE_LIFECYCLE).
 *
 * A share is assessed **once** — there is no re-rate / re-report (the server 409s
 * a second attempt), so the sheet only ever opens for an unassessed share and
 * always starts fresh (no pre-fill, no read-only/locked state).
 *
 * Passing `onBack` puts the sheet in **gated** mode: it becomes non-dismissable
 * (backdrop / pull-down won't close it — the share must be assessed first) and a
 * back button appears whose only job is to leave (the share detail screen opens
 * the sheet this way so an unrated share is rated before its details are usable).
 */
export function ShareAssessmentSheet({
  open,
  onClose,
  onBack,
  share: shareProp,
  onAssessed,
  onConflict,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, the sheet is gated: non-dismissable, with a back button that
   *  calls this to leave without assessing. */
  onBack?: () => void;
  share: AdvertiserSharePreview | null;
  onAssessed: (updated: AdvertiserSharePreview) => void;
  /**
   * The share turned out to be already assessed (server 4093 — it was rated
   * elsewhere, e.g. on the detail screen, and this surface's copy is stale).
   * The host should drop/refetch its stale item; the sheet alerts and closes
   * itself. Without this, every retry loops "Something went wrong" forever.
   */
  onConflict?: () => void;
}) {
  const { t } = useTranslation("shareAssessmentSheet");
  // Report reasons live in the feature-level `shares` namespace so this picker
  // and the detail screen's report section can't drift apart.
  const { t: tShares } = useTranslation("shares");
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout } = theme;
  const router = useRouter();
  const { width: winW, height: winH } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>("RATE");
  const [stars, setStars] = useState<number | null>(null);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Retain the last non-null share so the sheet keeps rendering its content
  // while it slides out. The parent nulls `share` at the same moment it flips
  // `open` to false; without this the component would return null and unmount
  // the BottomSheet instantly, snapping it away with no exit animation.
  const [shownShare, setShownShare] = useState<AdvertiserSharePreview | null>(
    shareProp,
  );
  useEffect(() => {
    if (shareProp) setShownShare(shareProp);
  }, [shareProp]);

  // A share is assessed once, so the sheet always opens fresh — reset every field
  // back to a blank rating each time it (re)opens.
  useEffect(() => {
    if (!open || !shareProp) return;
    setBusy(false);
    setMessage("");
    setReportType(null);
    setStars(null);
    setMode("RATE");
  }, [open, shareProp]);

  if (!shownShare) return null;
  const share = shownShare;

  // Fit the media within the sheet width and a share of the screen height,
  // keeping its true aspect ratio (whichever bound it hits first). Report mode
  // needs the room for its reason chips + message, so the post shrinks to a
  // thumbnail there — it's context, not the focus once you're reporting.
  const ar = clampAspectRatio(share.media.aspectRatio);
  const maxW = winW - 2 * layout.screenPadding;
  const maxH = winH * (mode === "REPORT" ? 0.16 : 0.4);
  let mediaW = maxW;
  let mediaH = maxW / ar;
  if (mediaH > maxH) {
    mediaH = maxH;
    mediaW = maxH * ar;
  }

  // The heading names the business inline when we have it, else falls back to the
  // plain title (no dangling "from").
  const businessName = share.local?.name;
  const titleKey =
    mode === "RATE"
      ? businessName
        ? "rateTitleNamed"
        : "rateTitle"
      : businessName
        ? "reportTitleNamed"
        : "reportTitle";

  const submit = async (
    body:
      | { kind: "RATING"; rating: number }
      | { kind: "REPORT"; reportType: ReportType; reportMessage?: string },
  ) => {
    setBusy(true);
    const res = await callAuthed(
      router,
      (jwt) => submitShareAssessment({ jwt, params: { uid: share.uid }, body }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok || !res.data) {
      setBusy(false);
      const code = !res.ok ? res.error?.error.code : undefined;
      // 4093: assessed elsewhere already (the once-only CAS) — this surface's
      // copy is stale. Tell the user, let the host drop/refetch it, and close;
      // retrying can only 409 again.
      if (code === 4093) {
        customAlert(t("alreadyAssessedTitle"), t("alreadyAssessedBody"));
        onConflict?.();
        onClose();
        return;
      }
      // Any other domain code is muted by the manual flag — never silent.
      if (typeof code === "number" && code >= 1000) {
        customAlert(t("assessFailedTitle"), t("assessFailedBody"));
      }
      return;
    }
    setBusy(false);
    // A completed rating is a positive moment — queue the store-review ask
    // (a report is not one). The host screen consumes it once the sheet is
    // gone (home, on focus/after assessment); the OS self-throttles displays.
    if (body.kind === "RATING") void queueStoreReview();
    onAssessed(res.data.share);
    onClose();
  };

  // Both outcomes confirm first — a rating feeds the customer's reward and a
  // report holds their payout, so neither should fire on a single tap.
  const confirmRating = () => {
    if (stars == null) return;
    customAlert(
      t("confirmRateTitle"),
      t("confirmRateMessage", { value: stars / 2 }),
      [
        { text: t("confirmCancel"), style: "cancel" },
        {
          text: t("submitRating"),
          onPress: () => submit({ kind: "RATING", rating: stars }),
        },
      ],
    );
  };
  const confirmReport = () => {
    if (reportType == null) return;
    customAlert(t("confirmReportTitle"), t("confirmReportMessage"), [
      { text: t("confirmCancel"), style: "cancel" },
      {
        text: t("submitReport"),
        style: "destructive",
        onPress: () =>
          submit({
            kind: "REPORT",
            reportType,
            reportMessage: message.trim() || undefined,
          }),
      },
    ]);
  };

  return (
    // Gated (onBack set) → non-dismissable: the backdrop / pull-down won't close
    // it, so the only exits are assessing the share or the back button.
    <BottomSheet open={open} onClose={onBack ? undefined : onClose}>
      <View style={{ gap: spacing.lg }}>
        {/* Gated back button — the sole way out without assessing. Left-aligned
            like a nav back, above the centered heading. */}
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            hitSlop={{ top: spacing.sm, bottom: spacing.sm, right: spacing.sm }}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                alignSelf: "flex-start",
                // Extra breathing room below the back row so it reads as sheet
                // chrome, separate from the content (on top of the container gap).
                marginBottom: spacing.md,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={color.text.secondary} />
            <Text style={[text.label, { color: color.text.secondary }]}>
              {t("back")}
            </Text>
          </Pressable>
        ) : null}

        {/* Heading — centered above the post, mirroring the rest of the sheet.
            Mode-aware (rate vs report) and names the business inline ("…from
            <name>") when we have it. */}
        <View style={{ gap: spacing.xs }}>
          <Text
            style={[
              text.title,
              { color: color.text.primary, textAlign: "center" },
            ]}
          >
            {t(titleKey, { name: businessName })}
          </Text>
          <Text
            style={[
              text.caption,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            {mode === "RATE" ? t("rateSubtitle") : t("reportSubtitle")}
          </Text>
        </View>

        {/* The post being judged — centered; a video autoplays (muted, looping).
            Tapping it (CustomMedia's default) opens the fullscreen viewer; a hint
            below advertises that. */}
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <CustomMedia
            media={share.media}
            thumbnail={share.thumbnail}
            renderVideo
            backgroundColor={color.ink}
            style={{
              width: mediaW,
              height: mediaH,
              borderRadius: radius.structure,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons
              name="expand-outline"
              size={13}
              color={color.text.tertiary}
            />
            <Text style={[text.micro, { color: color.text.tertiary }]}>
              {t("tapFullscreen")}
            </Text>
          </View>
        </View>

        {mode === "RATE" ? (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.sm,
              }}
            >
              <StarRating value={stars} onChange={setStars} size={40} />
              {stars != null && (
                <Text style={[text.label, { color: color.text.secondary }]}>
                  {t("starsSelected", { value: stars / 2 })}
                </Text>
              )}
            </View>
            <CustomButton
              type="primary"
              label={t("submitRating")}
              disabled={stars == null}
              loading={busy}
              onPress={confirmRating}
            />
            <CustomButton
              type="destructive"
              label={t("reportInstead")}
              icon="flag-outline"
              onPress={() => setMode("REPORT")}
            />
          </View>
        ) : (
          // Reason + message form, then a wider gap before the action buttons so
          // the CTA reads as its own block.
          <View style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.md }}>
              <CustomPicker
                items={ReportTypeValues.map((type) => ({
                  value: type,
                  label: tShares(`reason.${type}`),
                }))}
                value={reportType}
                setValue={setReportType}
                heading={t("reasonHeading")}
                placeholder={t("reasonPlaceholder")}
                preserveOrder
              />
              <CustomTextInput
                placeholder={t("messagePlaceholder")}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
              />
            </View>
            <View style={{ gap: spacing.md }}>
              <CustomButton
                type="destructive"
                label={t("submitReport")}
                disabled={reportType == null}
                loading={busy}
                onPress={confirmReport}
              />
              <CustomButton
                type="secondary"
                label={t("backToRate")}
                icon="arrow-back"
                onPress={() => setMode("RATE")}
              />
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}
