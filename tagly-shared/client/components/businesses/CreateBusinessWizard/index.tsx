import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Keyboard, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { callAuthed } from "../../../api/caller";
import { uploadPresigned } from "../../../services/uploads/uploadPresigned";
import { customAlert } from "../../feedback/alert";
import { alertBusinessFormError } from "../pageForm/formErrorAlert";
import {
  localDelete,
  localGet,
  localStore,
} from "../../../services/storage/localStorage";
import { Loading } from "../../primitives/Loading";
import type { ApiError, SupportedLocale } from "@tagly/models/shared";
import type {
  CreateBusinessInitBody,
  CreateBusinessInitResponse,
  CreateBusinessConfirmBody,
} from "@tagly/models/v2/advertiserApp";
import { StepBasics, type BasicsValues } from "../pageForm/StepBasics";
import { StepMedia, type FormMedia } from "../pageForm/StepMedia";
import {
  StepDetails,
  normalizeUrl,
  parseBusinessTags,
  type DetailsValues,
  type WeekHours,
} from "../pageForm/StepDetails";
import { weekHoursToPeriods } from "../pageForm/formMappers";

/** How far the entering step slides in from (px); direction depends on nav. */
const SLIDE_DISTANCE = 40;

/** The SDK-call result shape `callAuthed` consumes (see `api/caller.ts`). */
type SdkResult<T> = Promise<{
  status: number;
  json: T | ApiError;
  headers?: Record<string, string>;
}>;

/**
 * The two-phase create API the host injects — the ONLY app-specific part of
 * the wizard. The advertiser passes the `/v2/advertisers/me/businesses`
 * SDK functions; the admin passes the `/v2/admin/businesses` twins (identical
 * wire bodies by construction — the admin schemas alias/extend the advertiser
 * ones). `TBusiness` is whatever the confirm returns (`BusinessOwnerPreview`
 * for the advertiser, `AdminBusiness` for admin) and flows to `onCreated`.
 */
export type CreateBusinessWizardApi<TBusiness> = {
  init: (
    jwt: string,
    body: CreateBusinessInitBody,
  ) => SdkResult<CreateBusinessInitResponse>;
  confirm: (
    jwt: string,
    body: CreateBusinessConfirmBody & { tags?: string[] },
  ) => SdkResult<{ business: TBusiness }>;
};

/**
 * CreateBusinessWizard — the reusable "create a business page" flow, hosted by
 * the advertiser setup step, the advertiser in-app "add business page" screen,
 * and the admin Manage tab. Three sub-steps:
 *
 *   1. Basics — name, type (catalog slug), address
 *   2. Looks  — banner (16:9 locked crop) + gallery photos
 *   3. Details — description, links, phone, email, opening hours (all
 *      optional; + search tags when the host passes `enableTags` — admin)
 *
 * Only the ACTIVE step is mounted (so exactly one ScrollView exists at a time —
 * no nested/stacked scroll views to fight over gestures or bounds); the
 * form values live here in the wizard, so unmounting a step never loses input.
 * Each step slides + fades in on entry (up when going forward, down when going
 * back), keeping the "moving through steps" feel without a stacked pager.
 *
 * Submit runs the two-phase create through the injected `api`: `init` (pending
 * row + presigned POSTs) → upload banner + photos → `confirm` (validates media
 * server-side, promotes, writes details atomically). The presigns are
 * short-lived, so uploads start immediately after init.
 */
export function CreateBusinessWizard<TBusiness>({
  api,
  locale,
  draftKey,
  enableTags = false,
  onCreated,
  onSubmittingChange,
  stepHeader,
  firstStepFooter,
  topInset = true,
}: {
  /** The two-phase create endpoints (see {@link CreateBusinessWizardApi}). */
  api: CreateBusinessWizardApi<TBusiness>;
  /**
   * The market the page is created in — locks the address country and the
   * region list. The advertiser passes its own locale (the backend enforces
   * the match); the admin host lets the operator pick per business.
   */
  locale: SupportedLocale;
  /**
   * Local-storage key for draft persistence (typed fields survive an app
   * restart; images are re-picked — their cache URIs don't survive). Omit to
   * disable persistence entirely.
   */
  draftKey?: string;
  /** Render the admin-only search-tags section on the details step. */
  enableTags?: boolean;
  onCreated: (business: TBusiness) => void;
  /**
   * Fires whenever submission starts/stops (init → upload → confirm). Hosts use
   * it to lock their chrome while a create is in flight — e.g. the in-app host
   * hides its TopMenu so the back button can't abandon a half-done creation.
   *
   * Reports **false again once the page is created**, before `onCreated` fires:
   * hosts pair this with `useBlockBackWhile`, which blocks EVERY exit including
   * a programmatic `router.replace`, so staying "true" through the handoff would
   * swallow the host's own navigation. The wizard keeps its own overlay up in
   * that window, so the form still can't be re-submitted.
   */
  onSubmittingChange?: (submitting: boolean) => void;
  /**
   * Per-page header rendered INSIDE each step's scroll (so it scrolls away
   * with the content) — e.g. the setup host's progress overline, which each
   * page renders with its own 0-based sub-step baked in.
   */
  stepHeader?: (step: number) => ReactNode;
  /** Rendered under step 1's Continue (e.g. the setup step's "Set up later"). */
  firstStepFooter?: ReactNode;
  /**
   * Pad the top safe-area inset into each step's scroll (default — the setup
   * host renders no chrome above the wizard). A host that renders a TopMenu
   * above the wizard passes false, since the bar already consumes the inset.
   */
  topInset?: boolean;
}) {
  const { t } = useTranslation("businessPageForm");
  const router = useRouter();

  const [step, setStep] = useState(0);
  // Wait for the persisted draft before rendering, so a restart resumes where
  // the user left off instead of flashing an empty step 1.
  const [hydrated, setHydrated] = useState(false);
  // Entry animation for the active step (0 = just entered, 1 = settled).
  const enterAnim = useRef(new Animated.Value(1)).current;
  // +1 forward (slide up from below), -1 back (slide down from above). Read at
  // render for the interpolation; set synchronously before `setStep`.
  const directionRef = useRef(1);

  const [basics, setBasics] = useState<BasicsValues>({
    name: "",
    typeSlug: null,
    street: "",
    zip: "",
    city: "",
    region: null,
  });
  // FormMedia (pageForm's remote-or-local union) — in the create wizard every
  // entry is a fresh local pick; the remote kind exists for the edit screens.
  const [banner, setBanner] = useState<FormMedia | null>(null);
  const [photos, setPhotos] = useState<FormMedia[]>([]);
  const [details, setDetails] = useState<DetailsValues>({
    description: "",
    instagramTag: "",
    websiteUrl: "",
    reservationUrl: "",
    menuUrl: "",
    phoneNumber: "",
    contactEmail: "",
    tags: "",
  });
  const [hours, setHours] = useState<WeekHours>({});
  // Which submit phase is running (null = not submitting). Drives the
  // fullscreen overlay so the user sees WHERE a slow submit is: creating the
  // page (init), uploading the pictures, or waiting on server-side validation
  // (confirm — the slowest leg: S3 + Rekognition per image).
  //
  // `"created"` is TERMINAL and deliberately never resets: the page now exists,
  // and the host unmounts this wizard by navigating. Clearing the phase before
  // that navigation completes put a live submit button back under the user's
  // thumb for the whole transition, and a second tap created a duplicate page
  // (there is no idempotency key on the wire).
  const [submitPhase, setSubmitPhase] = useState<
    "init" | "uploading" | "confirming" | "created" | null
  >(null);
  const submitting = submitPhase !== null;
  // What the HOST is told. Deliberately excludes the terminal "created" phase:
  // hosts feed this to `useBlockBackWhile`, which swallows `beforeRemove` and so
  // blocks every exit — including the `router.replace` the host runs from
  // `onCreated`. Reporting "created" as busy stranded the user under the overlay
  // with the toast already shown. Excluding it also guarantees an exit: a host
  // that somehow fails to navigate has its back chrome restored.
  const submitInFlight = submitting && submitPhase !== "created";

  // Let the host lock its chrome (e.g. hide a back-capable TopMenu) while a
  // create is in flight — the overlay only covers the wizard, not host chrome.
  useEffect(() => {
    onSubmittingChange?.(submitInFlight);
  }, [submitInFlight, onSubmittingChange]);

  // Pending create → host handoff (deferred a tick; see the end of `submit`).
  // Cleared on unmount so a hand-off can't fire into a torn-down host if the
  // user leaves inside that one-tick window.
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    },
    [],
  );

  // ── Draft persistence: restore once on mount, save on every change. ──
  // Only the TYPED data is persisted — not the picked images. Their URIs point
  // into the OS cache dir, which can be purged between launches; a restored-but-
  // missing file would show a blank preview AND fail to upload. So images are
  // re-picked after a restart, and we never resume past the media step (the
  // banner is required) — everything the user typed still comes back.
  useEffect(() => {
    (async () => {
      if (!draftKey) {
        setHydrated(true);
        return;
      }
      const raw = await localGet(draftKey);
      if (raw) {
        try {
          const draft = JSON.parse(raw);
          if (draft.basics) {
            setBasics(draft.basics);
          }
          if (draft.details) {
            // Older drafts may predate a later-added field — merge over the
            // defaults so every DetailsValues key stays present.
            setDetails((v) => ({ ...v, ...draft.details }));
          }
          if (draft.hours) setHours(draft.hours);
          if (typeof draft.step === "number") setStep(Math.min(draft.step, 1));
        } catch {
          // Corrupt draft — start clean.
        }
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || !draftKey) return;
    void localStore(draftKey, JSON.stringify({ step, basics, details, hours }));
  }, [hydrated, draftKey, step, basics, details, hours]);

  // Slide + fade the active step in whenever it changes (and on first paint).
  useEffect(() => {
    if (!hydrated) return;
    enterAnim.setValue(0);
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [step, hydrated, enterAnim]);

  const goTo = (next: number) => {
    if (next === step) return;
    directionRef.current = next > step ? 1 : -1;
    setStep(next);
  };

  // The shared mapper (one copy for wizard + edit screens) shows the alert —
  // naming the exact field/image when the backend attached detail — and tells
  // us which step can fix it, so the wizard can jump the user straight there.
  const alertFormErrorAndJump = (err: ApiError | undefined) => {
    const step = alertBusinessFormError(err?.error.code, err?.error.errors, {
      mode: "create",
      countryLabel: t(locale === "CZ" ? "countryCz" : "countryUs"),
    });
    if (step) goTo({ basics: 0, media: 1, details: 2 }[step]);
  };

  const submit = async () => {
    if (submitting || banner?.kind !== "local" || !basics.typeSlug) return;
    // Everything in the create wizard is a local pick (nothing remote exists
    // yet) — unwrap once here so the phases below stay unchanged.
    const bannerMedia = banner.media;
    const photoMedia = photos.flatMap((p) =>
      p.kind === "local" ? [p.media] : [],
    );
    Keyboard.dismiss();
    setSubmitPhase("init");
    // Held so `onCreated` can fire OUTSIDE the try below — see the handoff note
    // after the catch.
    let created: TBusiness | null = null;
    try {
      // Phase 1 — pending row + presigned slots (short expiry: upload right away).
      // Domain codes are mapped to tailored alerts below — without the manual
      // flag the wrapper would fire its generic alert first (two per failure).
      const init = await callAuthed(
        router,
        (jwt) =>
          api.init(jwt, {
            name: basics.name,
            typeSlug: basics.typeSlug!,
            address: {
              country: locale === "CZ" ? "Czechia" : "United States",
              city: basics.city,
              region: basics.region,
              zip: basics.zip,
              street: basics.street,
            },
            // The wire schema normalizes/validates mimes; the picker only emits
            // image/* so the cast is safe.
            bannerMime: bannerMedia.mime as CreateBusinessInitBody["bannerMime"],
            photoMimes: photoMedia.map(
              (p) => p.mime,
            ) as CreateBusinessInitBody["photoMimes"],
          }),
        { handleSpecificErrorManually: true },
      );
      if (!init.ok || !init.data) {
        // The shared mapper names the exact field/image and returns the step
        // that can fix it — jump the user straight there.
        alertFormErrorAndJump(init.ok ? undefined : init.error);
        setSubmitPhase(null);
        return;
      }
      const { pendingBusinessId, uploads } = init.data;

      // Phase 1.5 — upload everything in parallel. uploadPresigned does NOT
      // alert on its own (its alert fn is caller-injected and nobody injects
      // one), so the failure MUST be surfaced here — a silent return left the
      // advertiser staring at step 3 with no page and no explanation (E045).
      setSubmitPhase("uploading");
      try {
        await Promise.all([
          uploadPresigned(uploads.banner, bannerMedia),
          ...uploads.photos.map((slot, i) =>
            uploadPresigned(slot, photoMedia[i]),
          ),
        ]);
      } catch {
        // Abandoned pending rows/keys are expired by the cleanup machinery.
        customAlert(t("uploadIncompleteTitle"), t("uploadIncompleteBody"));
        setSubmitPhase(null);
        return;
      }

      // Phase 2 — validate + promote + write details atomically.
      setSubmitPhase("confirming");
      const confirm = await callAuthed(
        router,
        (jwt) =>
          api.confirm(jwt, {
            pendingBusinessId,
            description: details.description.trim() || null,
            instagramTag: details.instagramTag.trim() || null,
            // Add the scheme the user may have omitted (cafetagly.com → https://…).
            websiteUrl: normalizeUrl(details.websiteUrl) || null,
            reservationUrl: normalizeUrl(details.reservationUrl) || null,
            menuUrl: normalizeUrl(details.menuUrl) || null,
            phoneNumber: details.phoneNumber.trim() || null,
            contactEmail: details.contactEmail.trim() || null,
            openingHours: weekHoursToPeriods(hours),
            // Search aliases ride the ADMIN wire only (its schema extends the
            // advertiser's with `tags`); advertiser hosts never enable them.
            ...(enableTags ? { tags: parseBusinessTags(details.tags) } : {}),
          }),
        { handleSpecificErrorManually: true },
      );
      if (!confirm.ok || !confirm.data) {
        alertFormErrorAndJump(confirm.ok ? undefined : confirm.error);
        setSubmitPhase(null);
        return;
      }

      // Terminal — the overlay stays up until the host navigates away, so the
      // form can never come back to life and re-arm submit.
      setSubmitPhase("created");
      // Created — the draft has served its purpose.
      if (draftKey) void localDelete(draftKey);
      created = confirm.data.business;
    } catch {
      // The injected api closures / callAuthed aren't expected to throw, but an
      // unexpected rejection must not strand the opaque submit overlay (which
      // also hides the host's back chrome via onSubmittingChange) — restore the
      // form with the generic alert.
      setSubmitPhase(null);
      alertFormErrorAndJump(undefined);
    }

    // Handoff runs OUTSIDE the try on purpose. The page already exists at this
    // point, so a throw from the host's navigation must NOT reach the catch
    // above — that would reset the phase and hand back a live submit button,
    // turning a failed navigation into a duplicate page.
    if (created) {
      const business = created;
      // ...and it is deferred a tick, never called synchronously. Hosts pair
      // `onSubmittingChange` with `useBlockBackWhile`, whose `usePreventRemove`
      // reads its flag from the latest COMMITTED render. The `false` we just
      // reported is still only *scheduled* here, so navigating in this tick is
      // swallowed by that listener's `e.preventDefault()` — which is what left
      // the finished wizard on screen with nothing but a toast, and a live
      // submit button behind it. One tick lets both commits land first.
      handoffTimerRef.current = setTimeout(() => onCreated(business), 0);
    }
  };

  // Direction-aware entry: slide from below when advancing, from above on back.
  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [directionRef.current * SLIDE_DISTANCE, 0],
  });

  return (
    <View style={{ flex: 1 }}>
      {hydrated && (
        <Animated.View
          style={{ flex: 1, opacity: enterAnim, transform: [{ translateY }] }}
        >
          {step === 0 && (
            <StepBasics
              header={stepHeader?.(0)}
              topInset={topInset}
              values={basics}
              onChange={(patch) => setBasics((v) => ({ ...v, ...patch }))}
              locale={locale}
              onContinue={() => goTo(1)}
              footer={firstStepFooter}
            />
          )}
          {step === 1 && (
            <StepMedia
              header={stepHeader?.(1)}
              topInset={topInset}
              businessName={basics.name}
              banner={banner}
              photos={photos}
              setBanner={setBanner}
              setPhotos={setPhotos}
              onBack={() => goTo(0)}
              onContinue={() => goTo(2)}
            />
          )}
          {step === 2 && (
            <StepDetails
              header={stepHeader?.(2)}
              topInset={topInset}
              businessName={basics.name}
              values={details}
              onChange={(patch) => setDetails((v) => ({ ...v, ...patch }))}
              hours={hours}
              setHours={setHours}
              locale={locale}
              enableTags={enableTags}
              onBack={() => goTo(1)}
              onSubmit={() => void submit()}
              submitting={submitting}
            />
          )}
        </Animated.View>
      )}

      {/* Fullscreen submit overlay — opaque (Loading's fullscreen form paints
          the themed background), so it both blocks interaction mid-submit and
          tells the user which leg is running instead of a silent spinner. */}
      {submitPhase ? (
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Loading
            fullscreen
            text={
              submitPhase === "init"
                ? t("submitPhaseInit")
                : submitPhase === "uploading"
                  ? t("submitPhaseUploading")
                  : submitPhase === "confirming"
                    ? t("submitPhaseConfirming")
                    : t("submitPhaseCreated")
            }
          />
        </View>
      ) : null}
    </View>
  );
}
