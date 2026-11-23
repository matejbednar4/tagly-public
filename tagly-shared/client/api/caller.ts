import Constants from "expo-constants";
import { Alert } from "react-native";
import { secureDelete, secureGet } from "../services/storage/secureStorage";
import { SHARED_SECURE_KEYS } from "../services/storage/keys";
import { ERROR_CODES, type ApiError } from "@tagly/models/shared";
import type { Router } from "expo-router";
// Import the local i18n module directly (not the "@tagly/client" barrel) to avoid
// an import cycle, since this file is itself part of @tagly/client.
import { i18n, type AppResources } from "../i18n";

// Suffixed `_one`/`_few`/`_many`/`_other` keys come from JSON; i18next resolves
// the base key (e.g. "rateLimitMessageWithTime") to a suffixed one based on the
// `count` option and the active language's plural rules. The literal `keyof`
// over the JSON only sees the suffixed forms, so we add the plural bases here.
type ApiErrorsKey =
  | keyof AppResources["apiErrors"]
  | "rateLimitMessageWithTime";

function t(key: ApiErrorsKey, vars?: Record<string, unknown>): string {
  return i18n.t(key as keyof AppResources["apiErrors"], {
    ns: "apiErrors",
    ...vars,
  });
}

// ---- alert function (dependency injection to avoid require cycle) ----
type AlertFn = (title: string, message?: string) => void;
let alertFn: AlertFn = (title, message) => Alert.alert(title, message);

/**
 * Register a custom alert function. Called by app root to use customAlert from @tagly/client.
 * This breaks the require cycle between utils and design packages.
 */
export function setAlertFn(fn: AlertFn): void {
  alertFn = fn;
}

// ---- update required callback ----
type UpdateRequiredCallback = (message: string) => void;
let onUpdateRequiredCallback: UpdateRequiredCallback | null = null;

/**
 * Register a callback to be called when the server returns CLIENT_OUTDATED (426).
 * The app's root component should call this to show an UpdateRequiredModal.
 */
export function setOnUpdateRequired(callback: UpdateRequiredCallback): void {
  onUpdateRequiredCallback = callback;
}

type UnauthorizedCallback = () => void;
let onUnauthorizedCallback: UnauthorizedCallback | null = null;

/**
 * Register a callback invoked when an authed call is rejected as unauthorized
 * (401) or finds no stored JWT. The app's session provider registers its
 * `signOut` here so the in-memory route guard flips to the logged-out stack —
 * `callAuthed` isn't a component and can't touch React state directly. When no
 * callback is registered, `callAuthed` falls back to clearing SecureStore +
 * `router.replace("/")` (legacy path, e.g. an app not yet on the session guard).
 */
export function setOnUnauthorized(callback: UnauthorizedCallback | null): void {
  onUnauthorizedCallback = callback;
}

// ---- types ----
type ApiHeaders = Record<string, string>;
type ApiResponse<T> = Promise<{
  status: number;
  json: T | ApiError;
  headers?: ApiHeaders;
}>;

type Ok<T> = {
  ok: true;
  status: number;
  data: T | undefined;
  headers?: ApiHeaders;
};
type Fail = { ok: false; status?: number; error?: ApiError };
type Result<T> = Ok<T> | Fail;

/** The `callAuthed`/`callPublic` result shape, for consumers that wrap them
 *  (e.g. `useDetailQuery`'s fetcher). */
export type CallerResult<T> = Result<T>;

type CallerOpts = {
  handleSpecificErrorManually?: boolean;
  suppressAlerts?: boolean;
};

// ---- logging (dev/staging only) ----
const { APP_ENV } = Constants.expoConfig?.extra as any;
if (!APP_ENV) {
  throw new Error("caller.ts: Missing APP_ENV in .env or app.config.ts");
}
const SHOULD_LOG = APP_ENV === "development" || APP_ENV === "staging";

function devLog(
  tag: string,
  payload: { status?: number; code?: number; message?: string; extra?: unknown }
) {
  if (!SHOULD_LOG) return;
  let prettyExtra: unknown = payload.extra;
  try {
    if (typeof payload.extra === "object" && payload.extra !== null) {
      prettyExtra = JSON.stringify(payload.extra, null, 2); // 2-space indent
    }
  } catch {
    // fallback if object isn't serializable (e.g. circular refs)
    prettyExtra = String(payload.extra);
  }

  // eslint-disable-next-line no-console
  console.warn(`[SDK][${tag}]`, {
    status: payload.status,
    code: payload.code,
    message: payload.message,
    extra: prettyExtra,
  });
}

// ---- helpers ----
function isApiError(x: any): x is ApiError {
  return !!x && typeof x === "object" && "error" in x;
}

function hasZodIssues(
  err: ApiError["error"]
): err is ApiError["error"] & { errors: { path: string; message: string }[] } {
  return "errors" in err && Array.isArray((err as any).errors);
}

function showFriendlyError(
  status: number | undefined,
  json: any,
  {
    handleSpecificsManually = false,
    headers,
  }: { handleSpecificsManually?: boolean; headers?: ApiHeaders } = {}
) {
  if (isApiError(json)) {
    const e = json.error;

    // Transport-ish (always log, user-friendly alerts)
    if (e.code === ERROR_CODES.SDK.TIMEOUT) {
      devLog("TIMEOUT", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("timeoutTitle"), t("timeoutMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SDK.NETWORK) {
      devLog("NETWORK", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("networkTitle"), t("networkMessage"));
      return;
    }

    if (status === 499 || e.code === ERROR_CODES.SDK.CANCELED) {
      // A cancellation is never a user-facing error — it's react-query aborting
      // an in-flight fetch on unmount, or the user navigating away mid-request.
      // Log it for diagnostics, but never alert (a spurious "request cancelled"
      // popup would fire on every screen left mid-fetch — e.g. deleting a
      // business, whose navigation aborts the detail query's refetch).
      devLog("CANCELED", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      return;
    }

    // Server-shape problems (log details, generic user alert)
    if (
      e.code === ERROR_CODES.SDK.INVALID_RES_PAYLOAD ||
      e.code === ERROR_CODES.SDK.INVALID_JSON
    ) {
      devLog("INVALID_RESPONSE", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("somethingWentWrongTitle"), t("somethingWentWrongMessage"));
      return;
    }

    if (
      e.code === ERROR_CODES.SERVER.ZOD ||
      e.code === ERROR_CODES.SDK.REQ_PREVALIDATION
    ) {
      // Log for developers, concise guidance for users
      devLog("VALIDATION", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      const details = hasZodIssues(e)
        ? e.errors.map((x) => x.message).join("\n")
        : t("validationFallback");
      alertFn(t("validationTitle"), t("validationHint", { details }));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.CLIENT_OUTDATED) {
      devLog("CLIENT_OUTDATED", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      // If callback is registered, trigger the blocking modal instead of Alert
      if (onUpdateRequiredCallback) {
        onUpdateRequiredCallback(e.message);
        return;
      }
      // Fallback to Alert if no callback registered
      alertFn(t("updateRequiredTitle"), t("updateRequiredMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.RATE_LIMIT) {
      // Try to read reset time from standard headers
      let resetSeconds: number | undefined;

      if (headers) {
        const rawReset =
          headers["RateLimit-Reset"] ??
          headers["ratelimit-reset"] ??
          headers["Retry-After"] ??
          headers["retry-after"];

        if (typeof rawReset === "string") {
          const parsed = Number(rawReset);
          if (!Number.isNaN(parsed) && parsed > 0) {
            resetSeconds = parsed;
          }
        }
      }

      let message = t("rateLimitMessage");

      if (typeof resetSeconds === "number") {
        // Math.max(1, ...) keeps the original "<=1 minute" branch's wording
        // (i18next picks the _one plural form when count === 1).
        const minutes = Math.max(1, Math.ceil(resetSeconds / 60));
        message = t("rateLimitMessageWithTime", { count: minutes });
      }

      devLog("RATE_LIMIT", {
        status,
        code: e.code,
        message: e.message,
        extra: {
          rawError: json,
          headers,
          resetSeconds,
        },
      });

      alertFn(t("rateLimitTitle"), message);
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.FAILED_TO_CREATE) {
      devLog("OTP_FAILED_TO_CREATE", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpFailedToCreateTitle"), t("otpFailedToCreateMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.SESSION_NOT_FOUND) {
      devLog("OTP_SESSION_NOT_FOUND", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpSessionExpiredTitle"), t("otpSessionExpiredMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.SENT_RECENTLY) {
      devLog("OTP_SENT_RECENTLY", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpSentRecentlyTitle"), t("otpSentRecentlyMessage"));
      return;
    }

    if (
      e.code === ERROR_CODES.SERVER.OTP.TOO_MANY_RESENDS ||
      e.code === ERROR_CODES.SERVER.OTP.MAX_RESENDS
    ) {
      devLog("OTP_TOO_MANY_RESENDS", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpTooManyResendsTitle"), t("otpTooManyResendsMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.EXPIRED_NEW_SENT) {
      devLog("OTP_EXPIRED_NEW_SENT", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpExpiredNewSentTitle"), t("otpExpiredNewSentMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.EXPIRED) {
      devLog("OTP_EXPIRED", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpExpiredTitle"), t("otpExpiredMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.TOO_MANY_ATTEMPTS_NEW_SENT) {
      devLog("OTP_TOO_MANY_ATTEMPTS_NEW_SENT", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(
        t("otpTooManyAttemptsNewSentTitle"),
        t("otpTooManyAttemptsNewSentMessage")
      );
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.TOO_MANY_ATTEMPTS) {
      devLog("OTP_TOO_MANY_ATTEMPTS", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpTooManyAttemptsTitle"), t("otpTooManyAttemptsMessage"));
      return;
    }

    if (e.code === ERROR_CODES.SERVER.OTP.INVALID) {
      devLog("OTP_INVALID", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("otpInvalidTitle"), t("otpInvalidMessage"));
      return;
    }

    // Account / Instagram bans (domain codes). Mapped centrally so every call
    // site that can hit them — connect/reconnect IG, create-share, withdrawal,
    // any future banned-gated endpoint — surfaces one consistent message with no
    // per-screen wiring. The passive banned surface (account hero + drawer) is
    // driven by `/me` status, not this error, so a plain alert here is correct.
    if (e.code === ERROR_CODES.DOMAIN.CUSTOMER_BANNED) {
      devLog("CUSTOMER_BANNED", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("accountBannedTitle"), t("accountBannedMessage"));
      return;
    }

    if (e.code === ERROR_CODES.DOMAIN.INSTAGRAM_BANNED) {
      devLog("INSTAGRAM_BANNED", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      alertFn(t("instagramBannedTitle"), t("instagramBannedMessage"));
      return;
    }

    // If caller wants to handle domain errors, suppress ONLY domain codes (1000+)
    if (
      handleSpecificsManually &&
      typeof e.code === "number" &&
      e.code >= 1000
    ) {
      devLog("DIFFERENT ERROR", {
        status,
        code: e.code,
        message: e.message,
        extra: json,
      });
      return;
    }

    // Fallback structured (log + generic user text)
    devLog("STRUCTURED_FALLBACK", {
      status,
      code: e.code,
      message: e.message,
      extra: json,
    });
    alertFn(t("somethingWentWrongTitle"), t("somethingWentWrongMessage"));
    return;
  }

  // Not customErrors
  devLog("HTTP_FALLBACK", {
    status,
    message: "Unexpected non-structured error",
    extra: json,
  });
  alertFn(t("unexpectedTitle"), t("unexpectedMessage"));
}

/** Public caller (no JWT required) */
export async function callPublic<T>(
  sdkCall: () => ApiResponse<T | ApiError>,
  opts?: CallerOpts
): Promise<Result<T>> {
  const res = await sdkCall();

  if (res.status === 304) {
    return { ok: true, status: 304, data: undefined, headers: res.headers };
  }

  if (res.status >= 200 && res.status < 300 && !isApiError(res.json)) {
    return {
      ok: true,
      status: res.status,
      data: res.json as T,
      headers: res.headers,
    };
  }

  // Always trigger update required callback, even with suppressAlerts
  if (isApiError(res.json) && res.json.error.code === ERROR_CODES.SERVER.CLIENT_OUTDATED) {
    if (onUpdateRequiredCallback) {
      onUpdateRequiredCallback(res.json.error.message);
    }
  }

  if (!opts?.suppressAlerts) {
    showFriendlyError(res.status, res.json, {
      handleSpecificsManually: opts?.handleSpecificErrorManually,
      headers: res.headers,
    });
  }
  return {
    ok: false,
    status: res.status,
    error: isApiError(res.json) ? (res.json as ApiError) : undefined,
  };
}

/** Authed caller (requires JWT; auto-logout if missing) */
export async function callAuthed<T>(
  router: Router,
  sdkCall: (jwt: string) => ApiResponse<T | ApiError>,
  opts?: CallerOpts
): Promise<Result<T>> {
  // JWT is stored in SecureStore and sent as a Bearer token.
  const jwt = await secureGet(SHARED_SECURE_KEYS.JWT);

  if (!jwt) {
    devLog("NO_JWT_LOCAL", { message: "Missing JWT in storage" });
    // No stored token but the guard still thinks we're authed → log out so it
    // flips. Falls back to navigating to root if no callback is registered.
    if (onUnauthorizedCallback) onUnauthorizedCallback();
    else router.replace("/");
    alertFn(t("sessionErrorTitle"), t("sessionErrorMessage"));
    return { ok: false };
  }

  const res = await sdkCall(jwt);

  if (res.status === 304) {
    return { ok: true, status: 304, data: undefined, headers: res.headers };
  }

  // Hard rule: unauthorized ⇒ logout regardless of manual handling flag
  if (res.status === 401) {
    devLog("AUTHTOKEN_401", {
      status: 401,
      message: "Unauthorized response",
      extra: res.json,
    });
    if (onUnauthorizedCallback) {
      // App-driven logout (clears SecureStore + flips the route guard in-session).
      onUnauthorizedCallback();
    } else {
      // Legacy fallback: clear the persisted JWT and navigate to root.
      await secureDelete(SHARED_SECURE_KEYS.JWT);
      router.replace("/");
    }
    alertFn(t("sessionExpiredTitle"), t("sessionExpiredMessage"));
    return {
      ok: false,
      status: 401,
      error: isApiError(res.json) ? (res.json as ApiError) : undefined,
    };
  }

  if (res.status >= 200 && res.status < 300 && !isApiError(res.json)) {
    return {
      ok: true,
      status: res.status,
      data: res.json as T,
      headers: res.headers,
    };
  }

  // Always trigger update required callback, even with suppressAlerts
  if (isApiError(res.json) && res.json.error.code === ERROR_CODES.SERVER.CLIENT_OUTDATED) {
    if (onUpdateRequiredCallback) {
      onUpdateRequiredCallback(res.json.error.message);
    }
  }

  if (!opts?.suppressAlerts) {
    showFriendlyError(res.status, res.json, {
      handleSpecificsManually: opts?.handleSpecificErrorManually,
      headers: res.headers,
    });
  }
  return {
    ok: false,
    status: res.status,
    error: isApiError(res.json) ? (res.json as ApiError) : undefined,
  };
}
