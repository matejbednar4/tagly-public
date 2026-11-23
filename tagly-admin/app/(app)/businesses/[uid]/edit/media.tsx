import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  adminUpdateBusinessMediaInit,
  adminUpdateBusinessMediaConfirm,
} from "@tagly/sdk/v2/adminApp";
import type { AdminUpdateBusinessMediaInitBody } from "@tagly/models/v2/adminApp";
import { BUSINESS_MAX_PHOTOS } from "@tagly/models/v2/crossApp";
import type { ApiError, LocalSubaccountUid } from "@tagly/models/shared";
import { useAdminBusiness } from "@/hooks/useAdminBusiness";

/**
 * Admin edit of a business's banner & photos — the shared `StepMedia` form
 * seeded with the CURRENT banner/photos as `remote` entries, over the
 * `/v2/admin/businesses/:uid/media/{init,confirm}` twins (keep-by-uid: kept
 * photos never re-upload; a pure removal skips init). The server re-runs the
 * create-time validation (banner 16:9 + Rekognition on every new image) and
 * swaps atomically. Two-phase save → `useBlockBackWhile` + hidden TopMenu
 * while in flight, exactly like the advertiser twin.
 */
export default function AdminEditBusinessMediaScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color } = theme;

  const { business: data } = useAdminBusiness(uid);
  const params = { uid: uid as LocalSubaccountUid };

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

  // Seed once from the loaded business.
  useEffect(() => {
    if (data && !seeded) {
      setBanner({ kind: "remote", media: data.banner });
      setPhotos(data.photos.map((media) => ({ kind: "remote", media })));
      setSeeded(true);
    }
  }, [data, seeded]);

  const save = async () => {
    if (!data || !banner || saving) return;

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

    const finish = () => {
      setSubmitPhase(null);
      showToast({ type: "success", text1: t("savedToast") });
      // Deferred a tick, never same-tick. `useBlockBackWhile`'s
      // `usePreventRemove` reads its flag from the latest COMMITTED render, so
      // the release above is still only scheduled here and a same-tick back()
      // is swallowed by its `preventDefault()` — leaving the user on a saved
      // screen with a live save button (the create wizard's E-class bug).
      setTimeout(() => router.back(), 0); // the detail screen refetches on focus
    };

    const confirmCall = (body: {
      pendingBannerId?: number;
      pendingPhotoIds: number[];
    }) =>
      callAuthed(
        router,
        (jwt) =>
          adminUpdateBusinessMediaConfirm({
            jwt,
            params,
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
      finish();
      return;
    }

    // New uploads: init (slots for the new files only) → upload → confirm.
    setSubmitPhase("uploading");
    const init = await callAuthed(
      router,
      (jwt) =>
        adminUpdateBusinessMediaInit({
          jwt,
          params,
          body: {
            // The wire schema normalizes/validates mimes; the picker only
            // emits image/* so the cast is safe.
            newBannerMime: newBanner?.mime as
              | AdminUpdateBusinessMediaInitBody["newBannerMime"],
            newPhotoMimes: newPhotos.map(
              (p) => p.mime,
            ) as AdminUpdateBusinessMediaInitBody["newPhotoMimes"],
            keepPhotoUids,
          },
        }),
      { handleSpecificErrorManually: true },
    );
    if (!init.ok || !init.data) {
      setSubmitPhase(null);
      const code = !init.ok ? init.error?.error.code : undefined;
      if (code === 5206) {
        customAlert(
          t("photoLimitTitle"),
          t("photoLimitBody", { max: BUSINESS_MAX_PHOTOS }),
        );
      } else if (code === 5203) {
        // The keep-list references a photo that no longer exists (the page
        // was edited elsewhere) — the seeded form is stale.
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
    finish();
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
      {!saving && (
        <TopMenu
          title={t("mediaEditTitle")}
          showBack
          hideMenu
          subheading={data?.name}
        />
      )}
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
