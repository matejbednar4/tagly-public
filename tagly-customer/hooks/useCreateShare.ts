import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { callAuthed, customAlert, queueStoreReview } from "@tagly/client";
import { createShare as createShareReq } from "@tagly/sdk/v2/customerApp";
import { ERROR_CODES } from "@tagly/models/shared";
import { IG_STORIES_QUERY_KEY, type IgStory } from "@/hooks/useIgStories";
import { useAnalytics, type ShareCreateSource } from "@/utils/analytics";

/**
 * Centralizes everything about monetizing a story into a share. Both surfaces that
 * create shares — the story-picker confirm screen
 * (`app/(app)/shares/create/confirm`) and the app-open `ShareOpportunitySheet`
 * one-tap create — go through this so the parts that must stay consistent live in
 * one place:
 *
 *   - the create-share request itself,
 *   - the analytics trio (`share_create_{submitted,succeeded,failed}`) stamped with
 *     the caller's `source` — so a new create site can't silently skip tracking,
 *   - dropping the just-monetized story from the IG-stories cache (so it can't be
 *     re-picked),
 *   - queuing the throttled store-review prompt (monetizing is a positive moment),
 *     and
 *   - **error presentation** — the domain-code → alert mapping (in the colocated
 *     `useCreateShare` namespace), so both surfaces show the same specific,
 *     actionable copy instead of a generic "something went wrong".
 *
 * `navigateOnError` controls the two error cases that route rather than alert: the
 * story-picker (`true`) sends 4100 (not tagged) → the tag-guidance screen and gives
 * 4106 (story expired) a "pick another" → back action; the opportunity sheet
 * (`false`) has no picker stack behind it, so both just show a plain alert.
 *
 * The caller keeps only its own success handling: the toast copy and the
 * navigation/exit (the picker `dismissAll`s its stack; the sheet `onClose`s). It
 * branches on the returned `callAuthed` result — on failure the hook has already
 * shown the error, so the caller just bails.
 *
 * `submitting` resets on every exit path (try/finally) — including success. The
 * sheet caller stays mounted for the whole authed session, so a flag that only
 * reset on failure would survive a successful create and permanently disable the
 * sheet's buttons the next time it opened (E012).
 */
export function useCreateShare() {
  const router = useRouter();
  const { t } = useTranslation("useCreateShare");
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const [submitting, setSubmitting] = useState(false);

  const createShare = async ({
    businessUid,
    storyId,
    source,
    businessName,
    navigateOnError = true,
  }: {
    businessUid: string;
    storyId: string;
    source: ShareCreateSource;
    /** Interpolated into the error copy + passed to the 4100 tag route. */
    businessName?: string;
    /** Picker routes on 4100/4106; the sheet (no picker stack) only alerts. */
    navigateOnError?: boolean;
  }) => {
    setSubmitting(true);
    try {
      track("share_create_submitted", { businessUid, source });

      const result = await callAuthed(
        router,
        (jwt) =>
          createShareReq({
            jwt,
            body: { businessUid, storyId, agreedToTermsOfMonetization: true },
          }),
        // Suppress callAuthed's generic domain-error alert so we can map codes to
        // specific copy below (transport/ban codes are still alerted centrally).
        { handleSpecificErrorManually: true },
      );

      if (result.ok) {
        track("share_create_succeeded", {
          businessUid,
          shareUid: result.data?.share?.uid ?? "",
          source,
        });
        // Drop the just-monetized story so the picker can't re-offer it (the server
        // also filters already-shared stories on its next fetch, so the two stay in
        // sync without a refetch that would burn the IG stories rate limit).
        queryClient.setQueryData<IgStory[]>(IG_STORIES_QUERY_KEY, (old) =>
          old ? old.filter((s) => s.id !== storyId) : old,
        );
        // Positive moment — queue a throttled store-review prompt (best-effort;
        // never blocks navigation).
        void queueStoreReview();
        return result;
      }

      track("share_create_failed", {
        businessUid,
        errorCode: result.error?.error.code ?? 0,
        source,
      });

      const code = result.error?.error.code;
      // Transport (no code), everything < 1000, and the two ban codes are alerted by
      // callAuthed's central handler (we only asked it to suppress domain codes
      // ≥ 1000) — so map only the actionable domain codes here.
      if (
        code !== undefined &&
        code >= 1000 &&
        code !== ERROR_CODES.DOMAIN.CUSTOMER_BANNED &&
        code !== ERROR_CODES.DOMAIN.INSTAGRAM_BANNED
      ) {
        showCreateShareError(code, businessName, storyId, businessUid, navigateOnError);
      }

      return result;
    } finally {
      setSubmitting(false);
    }
  };

  // Maps a create-share domain error code (≥ 1000) to a user-facing alert — or, for
  // the picker (`navigateOnError`), a route. Closes over `t`/`router` so both
  // surfaces show the same copy from the colocated `useCreateShare` namespace.
  const showCreateShareError = (
    code: number,
    businessName: string | undefined,
    storyId: string,
    businessUid: string,
    navigateOnError: boolean,
  ): void => {
    const businessLabel = businessName || t("thisBusiness");
    switch (code) {
    case 1514: // already shared this business within 24h
      customAlert(
        t("alreadyTodayTitle"),
        t("alreadyTodayMessage", { business: businessLabel }),
      );
      return;
    case 1013: // this exact story is already a share
      customAlert(t("alreadyStoryTitle"), t("alreadyStoryMessage"));
      return;
    case 4002: // not enough credits to fund the lock
    case 4003: // not currently shareable
      customAlert(
        t("budgetTitle"),
        t("budgetMessage", { business: businessLabel }),
      );
      return;
    case 5236: // can't estimate a reward yet (no Instagram reach data)
      customAlert(t("noRewardTitle"), t("noRewardMessage"));
      return;
    case 4106: // the story isn't live anymore (>24h) — pick another
      customAlert(
        t("storyExpiredTitle"),
        t("storyExpiredMessage"),
        navigateOnError
          ? [{ text: t("storyExpiredCta"), onPress: () => router.back() }]
          : undefined,
      );
      return;
    case 4107: // Instagram withholds this story's media (copyrighted music etc.)
      customAlert(
        t("storyMediaUnavailableTitle"),
        t("storyMediaUnavailableMessage"),
        navigateOnError
          ? [{ text: t("storyExpiredCta"), onPress: () => router.back() }]
          : undefined,
      );
      return;
    case 4001: // business not found / inactive
      customAlert(
        t("businessGoneTitle"),
        t("businessGoneMessage", { business: businessLabel }),
      );
      return;
    case 2008: // IG stories fetch failed
    case 5007: // no linked Instagram account
    case 5008: // IG link half-written (missing token/uid)
    case 5009: // Instagram access token expired
    case 5110: // Instagram token refresh failed
    case 4006: // IG permission verify failed (upstream)
    case 4007: // IG permission infra error
    case 4008: // IG permission check failed
    case 4099: // instagram_manage_insights permission not granted
      customAlert(t("instagramTitle"), t("instagramMessage"));
      return;
    case 4100: // the story didn't clearly tag the business
      if (navigateOnError) {
        // The dedicated guidance screen (picker flow). Replace, not push, so its
        // "choose another" goes back to the picker rather than the confirm step.
        router.replace({
          pathname: "/shares/create/tag",
          params: { businessUid, businessName, storyId },
        });
      } else {
        // No picker stack behind the sheet — a concise alert instead.
        customAlert(
          t("notTaggedTitle"),
          t("notTaggedMessage", { business: businessLabel }),
        );
      }
      return;
    default:
      customAlert(t("genericTitle"), t("genericMessage"));
      return;
    }
  };

  return { submitting, createShare };
}
