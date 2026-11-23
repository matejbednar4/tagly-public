import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import * as Localization from "expo-localization";
import { useTranslation } from "react-i18next";
import { router, type Href } from "expo-router";
import {
  callPublic,
  customAlert,
  secureGet,
  secureStore,
  secureDelete,
  localGet,
  localStore,
  requestAndGetExpoToken,
  signInWithGoogle,
  signInWithApple,
  showToast,
  i18n,
  SHARED_LOCAL_KEYS,
} from "@tagly/client";
import {
  type SupportedLocale,
  type SupportedLanguage,
  type Gender,
} from "@tagly/models/shared";
import {
  startEmail as startEmailReq,
  resendOtp as resendOtpReq,
  verifyOtp as verifyOtpReq,
  googleSignIn as googleSignInReq,
  appleSignIn as appleSignInReq,
  saveMarketingConsent as saveMarketingConsentReq,
  registerPendingPushToken as registerPendingPushTokenReq,
  attachReferrer as attachReferrerReq,
  saveProfile as saveProfileReq,
  completeRegistration as completeRegistrationReq,
  checkRegistration as checkRegistrationReq,
  instagramLogin as instagramLoginReq,
} from "@tagly/sdk/v2/customerApp";
import { suggestLocale as suggestLocaleReq } from "@tagly/sdk/v2/crossApp";
import { SECURE_KEYS, LOCAL_KEYS } from "@/constants/storageKeys";
import { useSession } from "@/contexts/session/SessionContext";
import { useOtpSession } from "@/contexts/otp/OtpSessionContext";
import { useInstagramAuthFlow } from "@/hooks/useInstagramAuthFlow";
import { useAnalytics } from "@/utils/analytics";

/**
 * Result of an auth action, telling the calling screen what to do next:
 * - `login`     — a JWT was obtained; `session.signIn` ran, the root guard will
 *                 flip to `(app)`. Caller does nothing.
 * - `registration` — a pending registration; caller should
 *                 `router.replace(outcome.next)`. `next` is resolved inside the
 *                 action from the fresh resume facts (state setters aren't
 *                 visible synchronously the same tick), avoiding a double-nav.
 * - `cancelled` — user backed out of a native / Instagram sheet. No-op.
 * - `error`     — failed; `callPublic` already alerted. Caller stays put.
 */
export type AuthOutcome =
  | { status: "login" }
  | { status: "registration"; next: Href }
  | { status: "cancelled" }
  // `instagram_taken` — the IG the user connected during registration already
  // belongs to another Tagly account (2214). Not an error to alert: the screen
  // reveals a "log into that account" recovery (re-auth via `loginWithInstagram`).
  | { status: "instagram_taken" }
  | { status: "error" };

interface OnboardingContextValue {
  hydrated: boolean;
  /** Region locale: undefined while resolving, null when it must be picked. */
  locale: SupportedLocale | null | undefined;
  email: string;
  registrationToken: string | null;
  profileComplete: boolean;
  consentResolved: boolean;
  pushResolved: boolean;
  seenOnboarding: boolean;
  /** OAuth name hint for prefilling the profile step (never written server-side). */
  suggestedFullName: string | null;

  setLocale: (l: SupportedLocale) => void;
  markOnboardingSeen: () => void;

  startEmail: (email: string) => Promise<boolean>;
  resendOtp: () => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<AuthOutcome>;
  continueWithGoogle: () => Promise<AuthOutcome>;
  continueWithApple: () => Promise<AuthOutcome>;
  /**
   * Forgot-email recovery: log in with the connected Instagram. Pass
   * `ephemeral: true` to run the OAuth in a private window (the reliable retry
   * when the standard login page stalls). Returns `{ status: "cancelled" }` when
   * the OAuth prompt didn't yield a code (cancel/dismiss/error) — the caller can
   * then offer the incognito retry.
   */
  loginWithInstagram: (ephemeral?: boolean) => Promise<AuthOutcome>;
  /**
   * Step actions resolve push/consent/profile, then return the **next route**
   * (computed from the value they just set, since React state isn't yet visible
   * synchronously). Save actions return `null` on failure so the caller stays.
   */
  enablePush: () => Promise<Href>;
  skipPush: () => Href;
  saveConsent: (enabled: boolean) => Promise<Href | null>;
  saveProfileStep: (data: {
    fullName: string;
    gender: Gender;
    interestSlugs: string[];
  }) => Promise<Href | null>;
  finishRegistration: (code?: string) => Promise<AuthOutcome>;

  /** The next route in the registration branch, from current facts + locale. */
  resolveNextRoute: () => Href;

  /**
   * Position of a step within THIS session's step list, for the
   * `StepProgressOverline` ("Setup · 2 of 4"). Totals count only the steps the
   * user still had to do when the registration branch was entered — steps
   * resolved in a previous session are excluded, so the counter never jumps or
   * grows mid-flow. Returns `null` when the overline should be hidden (step not
   * in this session's list, or fewer than 2 steps remain).
   */
  stepProgress: (
    step: "push" | "consent" | "profile" | "instagram",
  ) => { step: number; total: number } | null;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}

/**
 * Owns the registration-flow state, the v2 auth SDK actions, and the single
 * `resolveNextRoute()` that encodes step order + the EU-only consent skip.
 * Screens stay presentational: they call an action, then navigate on its result.
 * Mounted in `app/(onboarding)/_layout.tsx`.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("onboardingContext");
  const session = useSession();
  const otpSession = useOtpSession();
  const { track } = useAnalytics();
  const { prompt: promptInstagram, promptEphemeral: promptInstagramEphemeral } =
    useInstagramAuthFlow();

  const [hydrated, setHydrated] = useState(false);
  const [locale, setLocaleState] = useState<SupportedLocale | null | undefined>(
    undefined,
  );
  const [email, setEmail] = useState("");
  const [registrationToken, setRegistrationToken] = useState<string | null>(
    null,
  );
  const [profileComplete, setProfileComplete] = useState(false);
  const [consentResolved, setConsentResolved] = useState(false);
  const [pushResolved, setPushResolved] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [suggestedFullName, setSuggestedFullName] = useState<string | null>(
    null,
  );

  // Facts as they stood when the registration branch was (re)entered — the
  // baseline for `stepProgress`. A ref, not state: it's written right before the
  // step screens are navigated to and only read on their mount.
  const initialFacts = useRef<{
    push: boolean;
    consent: boolean;
    profile: boolean;
  } | null>(null);

  const language: SupportedLanguage = i18n.language?.startsWith("cs")
    ? "cs"
    : "en";

  // Boot: seen-onboarding flag, resume from a stored registration token, locale.
  useEffect(() => {
    (async () => {
      try {
        const seen = await localGet(LOCAL_KEYS.HAS_SEEN_ONBOARDING);
        setSeenOnboarding(!!seen);

        // Whether the notifications step was already shown (so a resumed
        // registration doesn't re-ask).
        const pushPrompted = await localGet(LOCAL_KEYS.PUSH_PROMPTED);
        setPushResolved(!!pushPrompted);

        const rt = await secureGet(SECURE_KEYS.REGISTRATION_TOKEN);
        if (rt) {
          const res = await callPublic(
            () => checkRegistrationReq({ registrationToken: rt }),
            { suppressAlerts: true },
          );
          if (res.ok && res.data) {
            // Resuming past sign-in: take the account's authoritative state
            // (locale + whether consent was already answered) and skip
            // suggest-locale (the picker won't be shown).
            setRegistrationToken(rt);
            setProfileComplete(res.data.profileComplete);
            setLocaleState(res.data.locale);
            setConsentResolved(res.data.marketingConsentResolved);
            initialFacts.current = {
              push: !!pushPrompted,
              consent: res.data.marketingConsentResolved,
              profile: res.data.profileComplete,
            };
            return;
          }
          // Stale/invalid token — drop it and fall through to a fresh suggest.
          await secureDelete(SECURE_KEYS.REGISTRATION_TOKEN);
        }

        // Fresh entry (sign-in will show) — suggest a locale for the picker.
        const timezone = Localization.getCalendars()[0]?.timeZone ?? undefined;
        const deviceRegion =
          Localization.getLocales()[0]?.regionCode ?? undefined;
        const localeRes = await callPublic(
          () => suggestLocaleReq({ timezone, deviceRegion }),
          { suppressAlerts: true },
        );
        setLocaleState(
          localeRes.ok && localeRes.data ? localeRes.data.locale : null,
        );
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setLocale = (l: SupportedLocale) => setLocaleState(l);

  const markOnboardingSeen = () => {
    setSeenOnboarding(true);
    void localStore(LOCAL_KEYS.HAS_SEEN_ONBOARDING, "1");
  };

  // Persist + apply a pending-registration result from any auth method (OTP
  // verify, Google, Apple) — the single funnel where a registrationToken is set
  // and the email is already verified.
  const applyRegistration = async (
    rt: string,
    complete: boolean,
    suggestedName?: string | null,
  ) => {
    await secureStore(SECURE_KEYS.REGISTRATION_TOKEN, rt);
    setRegistrationToken(rt);
    setProfileComplete(complete);
    if (suggestedName !== undefined) setSuggestedFullName(suggestedName);

    // If the user arrived via a referral deeplink, attach the captured code to
    // the pending account (resolved into the referral at complete-registration).
    // Best-effort — a referral must never block onboarding. The code persists in
    // REFERRAL_PREFILL until sign-in clears it, so a transient failure is fine.
    const referrerCode = await localGet(SHARED_LOCAL_KEYS.REFERRAL_PREFILL);
    if (referrerCode) {
      void attachReferrerReq({ registrationToken: rt, referrerCode }).catch(
        () => {},
      );
    }
  };

  const markPushResolved = () => {
    setPushResolved(true);
    void localStore(LOCAL_KEYS.PUSH_PROMPTED, "1");
  };

  // Notifications step: prompt for push permission and, if granted, register the
  // Expo token against the pending customer (backend migrates it to the Customer
  // at complete-registration). The device timezone rides along so the backend
  // can place pre-registration nudges in the user's real local quiet-hours
  // window (locale fallback is only right in the market's home timezone).
  // Resolves either way; returns the next route.
  const enablePush = async (): Promise<Href> => {
    let granted = false;
    try {
      const token = await requestAndGetExpoToken();
      if (token && registrationToken) {
        void registerPendingPushTokenReq({
          registrationToken,
          token,
          timezone: Localization.getCalendars()[0]?.timeZone ?? undefined,
        });
      }
      granted = !!token;
    } catch {
      // Permission denial / token failure shouldn't block onboarding.
    } finally {
      markPushResolved();
    }
    track("onboarding_push_resolved", { granted });
    return resolveNextRoute({ pushResolved: true });
  };

  const skipPush = (): Href => {
    markPushResolved();
    track("onboarding_push_resolved", { granted: false });
    return resolveNextRoute({ pushResolved: true });
  };

  const startEmail = async (e: string) => {
    if (!locale) return false;
    setEmail(e);
    const res = await callPublic(() =>
      startEmailReq({ email: e, locale, language }),
    );
    // 200 here means a code is out there (freshly sent or recently sent) — start
    // the resend cooldown either way.
    if (res.ok) {
      otpSession.markOtpSent();
      track("onboarding_path_email_submitted");
    }
    return res.ok;
  };

  const resendOtp = async () => {
    const res = await callPublic(() => resendOtpReq({ email }));
    if (res.ok) otpSession.markOtpSent();
    return res.ok;
  };

  const verifyOtp = async (otp: string): Promise<AuthOutcome> => {
    // OTP codes (<1000) still get the wrapper's central alerts; domain codes
    // are muted so 2211 (session gone AND no account for this email) gets a
    // tailored "start over" message instead of a generic failure.
    const res = await callPublic(() => verifyOtpReq({ email, otp }), {
      handleSpecificErrorManually: true,
    });
    if (!res.ok || !res.data) {
      const code = !res.ok ? res.error?.error.code : undefined;
      if (code === 2211) {
        customAlert(t("noAccountTitle"), t("noAccountBody"));
      } else {
        alertUnhandledDomainError(code);
      }
      return { status: "error" };
    }
    otpSession.reset(); // code consumed — drop the cooldown
    if (res.data.type === "login") {
      track("onboarding_path_email_verified", { outcome: "login" });
      await session.signIn(res.data.jwt);
      return { status: "login" };
    }
    track("onboarding_path_email_verified", { outcome: "registration" });
    await applyRegistration(res.data.registrationToken, res.data.profileComplete);
    // Apply the resume facts the backend returned, so logging into a
    // mid-onboarding pending account skips steps it already finished. Resolve
    // the next route from those fresh values (state isn't readable this tick).
    setLocaleState(res.data.locale);
    setConsentResolved(res.data.marketingConsentResolved);
    initialFacts.current = {
      push: pushResolved,
      consent: res.data.marketingConsentResolved,
      profile: res.data.profileComplete,
    };
    return {
      status: "registration",
      next: resolveNextRoute({
        locale: res.data.locale,
        consentResolved: res.data.marketingConsentResolved,
        profileComplete: res.data.profileComplete,
      }),
    };
  };

  // The OAuth / IG-login endpoints share one shape: a couple of actionable
  // identity codes worth a tailored message, and every other domain code
  // (upstream provider/IG failure, misconfig) folding to a generic alert.
  // These call sites pass `handleSpecificErrorManually`, which mutes domain
  // codes (>=1000) centrally — so we re-surface the unhandled ones here. Codes
  // <1000 (network, rate-limit, validation) are still alerted centrally, so we
  // leave them untouched to avoid a double alert.
  const alertUnhandledDomainError = (code: number | undefined) => {
    if (typeof code === "number" && code >= 1000) {
      customAlert(t("genericErrorTitle"), t("genericErrorBody"));
    }
  };

  // The pending registration is gone server-side (expired cleanup, or finished
  // on another device) — codes 2221/2222/2213 from the step endpoints. Every
  // retry would fail identically, so explain, drop the stale token, and land
  // back on sign-in for a fresh start (a re-verify restores any saved steps).
  const handleExpiredRegistration = async () => {
    customAlert(t("registrationExpiredTitle"), t("registrationExpiredBody"));
    await secureDelete(SECURE_KEYS.REGISTRATION_TOKEN);
    setRegistrationToken(null);
    router.replace("/");
  };

  const continueWithGoogle = async (): Promise<AuthOutcome> => {
    if (!locale) return { status: "cancelled" };
    let signed: { idToken: string } | null;
    try {
      signed = await signInWithGoogle();
    } catch {
      // callPublic handles SDK/network errors; this only catches a native
      // sign-in failure (the Google flow throwing before we reach the backend).
      showToast({ type: "error", text1: t("googleSignInError") });
      return { status: "error" };
    }
    if (!signed) return { status: "cancelled" };
    const res = await callPublic(
      () => googleSignInReq({ idToken: signed!.idToken, locale, language }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const code = res.error?.error.code;
      // 2235 = Google returned no email; 2239 = that email isn't verified.
      // Either way we can't create/find an account, so point them elsewhere.
      if (code === 2235 || code === 2239) {
        customAlert(
          t("noProviderEmailTitle"),
          t("noProviderEmailBody", { provider: "Google" }),
        );
      } else {
        alertUnhandledDomainError(code);
      }
      return { status: "error" };
    }
    if (!res.data) return { status: "error" };
    if (res.data.type === "login") {
      track("onboarding_path_oauth_submitted", { provider: "google", outcome: "login" });
      await session.signIn(res.data.jwt);
      return { status: "login" };
    }
    track("onboarding_path_oauth_submitted", {
      provider: "google",
      outcome: "registration",
    });
    await applyRegistration(
      res.data.registrationToken,
      res.data.profileComplete,
      res.data.suggestedFullName,
    );
    // Apply the resume facts (skip steps a mid-onboarding pending account already
    // finished) and resolve the next route from those fresh values.
    setLocaleState(res.data.locale);
    setConsentResolved(res.data.marketingConsentResolved);
    initialFacts.current = {
      push: pushResolved,
      consent: res.data.marketingConsentResolved,
      profile: res.data.profileComplete,
    };
    return {
      status: "registration",
      next: resolveNextRoute({
        locale: res.data.locale,
        consentResolved: res.data.marketingConsentResolved,
        profileComplete: res.data.profileComplete,
      }),
    };
  };

  const continueWithApple = async (): Promise<AuthOutcome> => {
    if (!locale) return { status: "cancelled" };
    let signed: {
      identityToken: string;
      nonce: string;
      fullName: string | null;
    } | null;
    try {
      signed = await signInWithApple();
    } catch {
      showToast({ type: "error", text1: t("appleSignInError") });
      return { status: "error" };
    }
    if (!signed) return { status: "cancelled" };
    const res = await callPublic(
      () =>
        appleSignInReq({
          identityToken: signed!.identityToken,
          nonce: signed!.nonce,
          fullName: signed!.fullName ?? undefined,
          locale,
          language,
        }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const code = res.error?.error.code;
      // 2235 = Apple returned no email; 2239 = that email isn't verified. Common
      // on a re-authorization where Apple stops resharing the email, leaving us
      // nothing to key an account on.
      if (code === 2235 || code === 2239) {
        customAlert(
          t("noProviderEmailTitle"),
          t("noProviderEmailBody", { provider: "Apple" }),
        );
      } else {
        alertUnhandledDomainError(code);
      }
      return { status: "error" };
    }
    if (!res.data) return { status: "error" };
    if (res.data.type === "login") {
      track("onboarding_path_oauth_submitted", { provider: "apple", outcome: "login" });
      await session.signIn(res.data.jwt);
      return { status: "login" };
    }
    track("onboarding_path_oauth_submitted", {
      provider: "apple",
      outcome: "registration",
    });
    await applyRegistration(
      res.data.registrationToken,
      res.data.profileComplete,
      res.data.suggestedFullName,
    );
    // Apply the resume facts (skip steps a mid-onboarding pending account already
    // finished) and resolve the next route from those fresh values.
    setLocaleState(res.data.locale);
    setConsentResolved(res.data.marketingConsentResolved);
    initialFacts.current = {
      push: pushResolved,
      consent: res.data.marketingConsentResolved,
      profile: res.data.profileComplete,
    };
    return {
      status: "registration",
      next: resolveNextRoute({
        locale: res.data.locale,
        consentResolved: res.data.marketingConsentResolved,
        profileComplete: res.data.profileComplete,
      }),
    };
  };

  const loginWithInstagram = async (
    ephemeral = false,
  ): Promise<AuthOutcome> => {
    const result = ephemeral
      ? await promptInstagramEphemeral()
      : await promptInstagram();
    if (result.type !== "success") return { status: "cancelled" };
    const res = await callPublic(
      () => instagramLoginReq({ code: result.params.code }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const code = res.error?.error.code;
      // 2215 = this Instagram isn't linked to any Tagly account. This is the
      // "recover my login" dead-end: tell them plainly so they sign up instead
      // of retrying against an account that doesn't exist.
      if (code === 2215) {
        customAlert(t("noInstagramAccountTitle"), t("noInstagramAccountBody"));
      } else {
        alertUnhandledDomainError(code);
      }
      return { status: "error" };
    }
    if (!res.data) return { status: "error" };
    await session.signIn(res.data.jwt);
    return { status: "login" };
  };

  const saveConsent = async (enabled: boolean): Promise<Href | null> => {
    if (!registrationToken) return null;
    const res = await callPublic(
      () =>
        saveMarketingConsentReq({
          registrationToken,
          promoNotificationsEnabled: enabled,
        }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const code = res.error?.error.code;
      if (code === 2221) await handleExpiredRegistration();
      else alertUnhandledDomainError(code);
      return null;
    }
    setConsentResolved(true);
    track("onboarding_consent_submitted", { enabled });
    return resolveNextRoute({ consentResolved: true });
  };

  const saveProfileStep = async (data: {
    fullName: string;
    gender: Gender;
    interestSlugs: string[];
  }): Promise<Href | null> => {
    if (!registrationToken) return null;
    const res = await callPublic(
      () => saveProfileReq({ registrationToken, ...data }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const code = res.error?.error.code;
      if (code === 2222) await handleExpiredRegistration();
      // 4951 = the name profanity gate (the name is shown to advertisers).
      else if (code === 4951) {
        customAlert(t("nameFlaggedTitle"), t("nameFlaggedBody"));
      } else alertUnhandledDomainError(code);
      return null;
    }
    setProfileComplete(true);
    track("onboarding_profile_submitted");
    return resolveNextRoute({ profileComplete: true });
  };

  const finishRegistration = async (code?: string): Promise<AuthOutcome> => {
    if (!registrationToken) return { status: "error" };
    const res = await callPublic(
      () => completeRegistrationReq({ registrationToken, code }),
      { handleSpecificErrorManually: true },
    );
    if (!res.ok) {
      const errCode = res.error?.error.code;
      // 2214 = the connected IG already belongs to another Tagly account. Never
      // a silent login into it — hand back to the screen so it can offer the
      // "log into that account" recovery.
      if (errCode === 2214) return { status: "instagram_taken" };
      // 2213 = pending gone / profile incomplete; 1202 = a concurrent finish
      // already promoted it. Both mean this token is dead — start over (a
      // fresh email sign-in logs into the account if it was promoted).
      if (errCode === 2213 || errCode === 1202) await handleExpiredRegistration();
      else alertUnhandledDomainError(errCode);
      return { status: "error" };
    }
    if (!res.data) return { status: "error" };
    // completeRegistration only ever creates a brand-new Customer now (a taken IG
    // is a 2214 above, not a login), so this is always a new account.
    track("onboarding_completed", {
      connectedInstagram: !!code,
      isNewAccount: true,
    });
    await session.signIn(res.data.jwt);
    return { status: "login" };
  };

  // `overrides` let an action pass the value it *just* set — React state updates
  // aren't visible to a synchronous call in the same tick, so without this the
  // resolver would re-pick the screen the user just completed (the double-nav bug).
  const resolveNextRoute = (overrides?: {
    locale?: SupportedLocale | null | undefined;
    pushResolved?: boolean;
    consentResolved?: boolean;
    profileComplete?: boolean;
  }): Href => {
    const s = {
      locale,
      pushResolved,
      consentResolved,
      profileComplete,
      ...overrides,
    };
    // Notifications first (right after identity), so push can later nudge a
    // dropped-off profile. Then marketing consent (every locale — see v2.0.0.md
    // §7: one combined email+push opt-in, no US auto-opt-in), then the rest.
    if (!s.pushResolved) return "/notifications";
    if (!s.consentResolved) return "/consent";
    if (!s.profileComplete) return "/profile";
    return "/instagram";
  };

  // The counted step order mirrors resolveNextRoute. Instagram is always the
  // final step of a registration, so it's always in the session's list.
  const stepProgress = (
    step: "push" | "consent" | "profile" | "instagram",
  ): { step: number; total: number } | null => {
    const facts = initialFacts.current;
    if (!facts) return null;
    const steps: ("push" | "consent" | "profile" | "instagram")[] = [];
    if (!facts.push) steps.push("push");
    if (!facts.consent) steps.push("consent");
    if (!facts.profile) steps.push("profile");
    steps.push("instagram");
    const i = steps.indexOf(step);
    // A lone remaining step ("1 of 1") reads as noise — hide the overline.
    if (i === -1 || steps.length < 2) return null;
    return { step: i + 1, total: steps.length };
  };

  const value = useMemo<OnboardingContextValue>(
    () => ({
      hydrated,
      locale,
      email,
      registrationToken,
      profileComplete,
      consentResolved,
      pushResolved,
      seenOnboarding,
      suggestedFullName,
      setLocale,
      markOnboardingSeen,
      startEmail,
      resendOtp,
      verifyOtp,
      continueWithGoogle,
      continueWithApple,
      loginWithInstagram,
      enablePush,
      skipPush,
      saveConsent,
      saveProfileStep,
      finishRegistration,
      resolveNextRoute,
      stepProgress,
    }),
    // Action closures read current state on call; state values drive consumers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hydrated,
      locale,
      email,
      registrationToken,
      profileComplete,
      consentResolved,
      pushResolved,
      seenOnboarding,
      suggestedFullName,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
