import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  callAuthed,
  customAlert,
  alertBusinessFormError,
  showToast,
  uploadPresigned,
  Loading,
  TopMenu,
  useTheme,
  StepMedia,
  diffFormMedia,
  useBlockBackWhile,
  type FormMedia,
} from "@tagly/client";
import {
  updateBusinessMediaInit,
  updateBusinessMediaConfirm,
} from "@tagly/sdk/v2/advertiserApp";
import { BUSINESS_MAX_PHOTOS } from "@tagly/models/v2/advertiserApp";
import type { ApiError } from "@tagly/models/shared";
import type {
  UpdateBusinessMediaConfirmResponse,
  UpdateBusinessMediaInitBody,
} from "@tagly/models/v2/advertiserApp";
import { useBusiness } from "@/hooks/details/useBusiness";

/**
 * Edit banner & photos (`/businesses/:uid/settings/media`) — the `StepMedia`
 * form (shared with the create wizard) seeded with the business's CURRENT
 * banner/photos as `remote` entries; the owner replaces the banner, adds
 * photos (fresh `local` picks), or removes photos — existing pictures are kept
 * by uid, never re-downloaded or re-uploaded.
 *
 * Save mirrors the create submit's phases: with new uploads it runs media
 * `init` (presigned slots for the new files only) → `uploadPresigned` each →
 * `confirm`; a pure removal skips straight to `confirm`. The server re-runs
 * the exact create-time validation (banner 16:9 + Rekognition moderation on
 * every new image) and swaps everything atomically.
 */
export default function EditBusinessMediaScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;
  const queryClient = useQueryClient();

  const query = useBusiness(uid ?? "", router);
  const data = query.data;

  const [banner, setBanner] = useState<FormMedia | null>(null);
  const [photos, setPhotos] = useState<FormMedia[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<
    "uploading" | "confirming" | null
  >(null);
  const saving = submitPhase !== null;
  // The two-phase save must not be abandoned mid-flight: the overlay covers
  // the TopMenu's back button, and this blocks the edge-swipe + hardware back.
  useBlockBackWhile(saving);

  // Seed once from the loaded business; background refetches must not clobber.
  useEffect(() => {
    if (data && !seeded) {
      setBanner({ kind: "remote", media: data.banner });
      setPhotos(data.photos.map((media) => ({ kind: "remote", media })));
      setSeeded(true);
    }
  }, [data, seeded]);

  const save = async () => {
    if (!data || !banner || saving) return;

    // What's kept/added relative to the loaded business — the shared
    // keep-by-uid mapper (also used by the admin media edit screen).
    const { keepPhotoUids, newPhotos, newBanner } = diffFormMedia(
      banner,
      photos,
    );

    // Nothing changed at all → nothing to save.
    if (
      !newBanner &&
      newPhotos.length === 0 &&
      keepPhotoUids.length === data.photos.length
    ) {
      router.back();
      return;
    }

    // Confirm before committing (the CTA is always on screen). No changes above
    // already backed out silently.
    customAlert(t("saveConfirmTitle"), t("saveConfirmBody"), [
      { text: t("saveConfirmCancel"), style: "cancel" },
      { text: t("saveConfirmCta"), onPress: () => void commit() },
    ]);
  };

  const commit = async () => {
    if (!data || !banner || saving) return;

    const { keepPhotoUids, newPhotos, newBanner } = diffFormMedia(
      banner,
      photos,
    );

    const finish = (confirm: UpdateBusinessMediaConfirmResponse) => {
      setSubmitPhase(null);
      queryClient.setQueryData(["business", uid], confirm.business);
      showToast({ type: "success", text1: t("savedToast") });
      // Deferred a tick, never same-tick. `useBlockBackWhile`'s
      // `usePreventRemove` reads its flag from the latest COMMITTED render, so
      // the release above is still only scheduled here and a same-tick back()
      // is swallowed by its `preventDefault()` — leaving the user on a saved
      // screen with a live save button (the create wizard's E-class bug).
      setTimeout(() => router.back(), 0);
    };

    const confirmCall = (body: {
      pendingBannerId?: number;
      pendingPhotoIds: number[];
    }) =>
      callAuthed(
        router,
        (jwt) =>
          updateBusinessMediaConfirm({
            jwt,
            params: { uid: uid ?? "" },
            body: { ...body, keepPhotoUids },
          }),
        { handleSpecificErrorManually: true },
      );

    // Pure removal — no uploads, straight to confirm.
    if (!newBanner && newPhotos.length === 0) {
      setSubmitPhase("confirming");
      const confirm = await confirmCall({ pendingPhotoIds: [] });
      if (!confirm.ok || !confirm.data) {
        handleConfirmError(confirm.ok ? undefined : confirm.error);
        return;
      }
      finish(confirm.data);
      return;
    }

    // New uploads: init (slots for the new files only) → upload → confirm.
    setSubmitPhase("uploading");
    const init = await callAuthed(router, (jwt) =>
      updateBusinessMediaInit({
        jwt,
        params: { uid: uid ?? "" },
        body: {
          // The wire schema normalizes/validates mimes; the picker only emits
          // image/* so the cast is safe.
          newBannerMime: newBanner?.mime as
            | UpdateBusinessMediaInitBody["newBannerMime"],
          newPhotoMimes: newPhotos.map(
            (p) => p.mime,
          ) as UpdateBusinessMediaInitBody["newPhotoMimes"],
          keepPhotoUids,
        },
      }),
      { handleSpecificErrorManually: true },
    );
    if (!init.ok || !init.data) {
      setSubmitPhase(null);
      const code = !init.ok ? init.error?.error.code : undefined;
      if (code === 5206) {
        customAlert(t("photoLimitTitle"), t("photoLimitBody", { max: BUSINESS_MAX_PHOTOS }));
      } else if (code === 5203) {
        // The keep-list references a photo that no longer exists (the page was
        // edited elsewhere) — the seeded form is stale.
        customAlert(t("mediaStaleTitle"), t("mediaStaleBody"));
      } else if (typeof code === "number" && code >= 1000) {
        customAlert(t("saveFailedTitle"), t("saveFailedBody"));
      }
      return;
    }
    const { uploads } = init.data;

    try {
      await Promise.all([
        ...(uploads.banner && newBanner
          ? [uploadPresigned(uploads.banner, newBanner)]
          : []),
        ...uploads.photos.map((slot, i) => uploadPresigned(slot, newPhotos[i])),
      ]);
    } catch {
      // Abandoned pending rows/keys are expired by the cleanup machinery.
      // uploadPresigned does NOT alert on its own (its alert fn is
      // caller-injected and nobody injects one) — surface the failure here or
      // the save dies silently (E045).
      customAlert(t("uploadIncompleteTitle"), t("uploadIncompleteBody"));
      setSubmitPhase(null);
      return;
    }

    setSubmitPhase("confirming");
    const confirm = await confirmCall({
      pendingBannerId: uploads.banner?.pendingMediaId,
      pendingPhotoIds: uploads.photos.map((p) => p.pendingMediaId),
    });
    if (!confirm.ok || !confirm.data) {
      handleConfirmError(confirm.ok ? undefined : confirm.error);
      return;
    }
    finish(confirm.data);
  };

  // Confirm failures go through the shared mapper (one copy with the create
  // wizard) — it names the exact image and reason when the backend attached
  // detail (which photo was flagged and for what, too large vs not uploaded).
  const handleConfirmError = (err: ApiError | undefined) => {
    setSubmitPhase(null);
    alertBusinessFormError(err?.error.code, err?.error.errors, {
      mode: "edit",
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("editPageTitle")} showBack subheading={data?.name} />
      {!seeded || !data ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <StepMedia
          topInset={false}
          title={t("mediaEditTitle")}
          subtitle={t("mediaEditSubtitle", { business: data.name })}
          businessName={data.name}
          banner={banner}
          photos={photos}
          setBanner={setBanner}
          setPhotos={setPhotos}
          onContinue={() => void save()}
          ctaLabel={t("save")}
          loading={saving}
        />
      )}

      {/* Fullscreen phase overlay — same treatment as the create wizard's. */}
      {submitPhase ? (
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Loading
            fullscreen
            text={
              submitPhase === "uploading"
                ? t("submitPhaseUploading")
                : t("submitPhaseConfirming")
            }
          />
        </View>
      ) : null}
    </View>
  );
}
