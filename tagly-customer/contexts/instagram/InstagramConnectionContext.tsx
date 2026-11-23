import { CustomerInstagramAccount } from "@tagly/models/v2/customerApp";
import { ERROR_CODES } from "@tagly/models/shared";
import { connectInstagram, refreshInstagram } from "@tagly/sdk/v2/customerApp";
import { callAuthed } from "@tagly/client";
import { customAlert } from "@tagly/client";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useCustomer } from "../Customer";
import {
  useInstagramAuthFlow,
  type AuthFlowResult,
} from "@/hooks/useInstagramAuthFlow";
import InstagramPermissionSheet from "@/components/instagram/InstagramPermissionSheet";

/**
 * Unified Instagram connection state (ported from origin/main).
 * - NOT_LINKED: user skipped Instagram (no blocking modal)
 * - LOADING: the IG probe is in flight
 * - CONNECTED: linked and working
 * - MISSING_PERMISSION: connected but missing the insights permission (code 4099)
 * - DISCONNECTED: deauthorized from Instagram (codes 5007/5008)
 * - EXPIRED_TOKEN: long-lived token expired / refresh failed (codes 5009/5110)
 */
export type InstagramState =
  | "NOT_LINKED"
  | "LOADING"
  | "CONNECTED"
  | "MISSING_PERMISSION"
  | "DISCONNECTED"
  | "EXPIRED_TOKEN";

export type InstagramConnectionContextType = {
  instagramState: InstagramState;
  setInstagramState: React.Dispatch<React.SetStateAction<InstagramState>>;
  /**
   * Probe Instagram (`POST /me/instagram/refresh`): maps the connection-state
   * error codes into `instagramState`, refreshes the cached IG profile, and
   * starts snapshot polling when one was queued. Called on app open and after a
   * reconnect.
   */
  getInstagramStatus: () => Promise<void>;
  /**
   * The full cold-start resolution: (re)load the customer, then either probe
   * Instagram (linked) or settle on NOT_LINKED. Commits a definitive state ONLY
   * when it actually knows it — if the customer can't be loaded (offline), the
   * state stays LOADING rather than guessing. Called by the app shell on cold
   * start / resume, and by any "still loading — try again" retry affordance
   * (which must re-run the WHOLE resolve: a bare probe on a user whose /me
   * never loaded would mis-map "no Instagram account" to CONNECTED).
   */
  resolveInstagramState: () => Promise<void>;
  /**
   * Run the IG OAuth flow and link/re-authorize the account
   * (`POST /me/instagram/connect`): recovers a DISCONNECTED / EXPIRED_TOKEN /
   * MISSING_PERMISSION state, or links IG for a NOT_LINKED user. On success it
   * re-probes via `getInstagramStatus`.
   *
   * Returns `true` when the caller should offer the incognito retry — i.e. the
   * OAuth flow was cancelled / dismissed / errored (the login page stalled)
   * rather than yielding a code. The caller keeps this **local** so the retry
   * only shows on the instance the user actually used, not on every mounted
   * prompt (drawer + account hub + settings).
   */
  reconnectInstagram: () => Promise<boolean>;
  /**
   * Re-run the reconnect in a private browser window — the reliable fallback
   * when the standard flow stalls. Same `boolean` return as `reconnectInstagram`.
   */
  reconnectInstagramIncognito: () => Promise<boolean>;
  /** True while the audience snapshot queued by a probe is being taken. */
  isTakingSnapshot: boolean;
  setIsTakingSnapshot: React.Dispatch<React.SetStateAction<boolean>>;
};

const InstagramConnectionContext =
  createContext<InstagramConnectionContextType | null>(null);

export function useInstagramConnection(): InstagramConnectionContextType {
  const context = useContext(InstagramConnectionContext);
  if (!context) {
    throw new Error(
      "useInstagramConnection must be used within InstagramConnectionProvider"
    );
  }
  return context;
}

/**
 * The Instagram connection-status line for the current `instagramState`, shared
 * by every surface that surfaces it (the drawer + the Account hub) so the copy
 * and the danger toning stay identical. Returns `null` when there's nothing to
 * say (healthy or still loading); otherwise the localized text and whether it
 * should read as a problem (danger-toned).
 */
export function useInstagramStatusLabel(): {
  text: string;
  danger: boolean;
} | null {
  const { t } = useTranslation("instagramConnection");
  const { instagramState } = useInstagramConnection();
  switch (instagramState) {
    case "CONNECTED":
    case "LOADING":
      return null;
    case "NOT_LINKED":
      return { text: t("statusNotConnected"), danger: false };
    case "MISSING_PERMISSION":
      return { text: t("statusMissingPermission"), danger: true };
    case "DISCONNECTED":
      return { text: t("statusDisconnected"), danger: true };
    case "EXPIRED_TOKEN":
      return { text: t("statusExpired"), danger: true };
  }
}

/**
 * Owns everything Instagram for the logged-in customer: the connection state,
 * the probe, the snapshot flag, and patching the cached IG profile (through
 * `CustomerContext.setCustomer` — so it must be mounted **inside**
 * `CustomerProvider`). Starts in LOADING (the app-open flow probes on cold start
 * for linked users; no-IG users are set to NOT_LINKED immediately).
 */
export const InstagramConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { t } = useTranslation("instagramConnection");
  const { setCustomer, reloadCustomer } = useCustomer();
  const { prompt, promptEphemeral } = useInstagramAuthFlow();
  const [instagramState, setInstagramState] =
    useState<InstagramState>("LOADING");
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  // The 4099 insights-permission explainer (see InstagramPermissionSheet).
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);

  // Patch the cached IG account on the customer (`instagram !== null` is the
  // "linked" check now — CustomerMe dropped the redundant flag).
  const updateInstagramData = useCallback(
    (instagram: CustomerInstagramAccount) => {
      setCustomer((prev) => (prev ? { ...prev, instagram } : prev));
    },
    [setCustomer]
  );

  const getInstagramStatus = useCallback(async () => {
    setInstagramState("LOADING");
    const result = await callAuthed(router, (jwt) => refreshInstagram({ jwt }), {
      suppressAlerts: true,
    });

    if (!result.ok) {
      const code = result.error?.error.code;
      if (result.status === 403 && code === 4099) {
        setInstagramState("MISSING_PERMISSION");
        return;
      }
      if (result.status === 400 && (code === 5007 || code === 5008)) {
        setInstagramState("DISCONNECTED");
        return;
      }
      if (
        (result.status === 400 && code === 5009) ||
        (result.status === 502 && code === 5110)
      ) {
        setInstagramState("EXPIRED_TOKEN");
        return;
      }
      // Offline / transport failure (backend unreachable): we genuinely can't
      // tell the connection state, so stay LOADING instead of guessing CONNECTED.
      // Guessing would mask a real broken/expired link, and — worse — a "no
      // Instagram" guess elsewhere pops IG-gated nudges (the story-views modal)
      // just because we're offline. Re-probed on the next foreground.
      if (
        code === ERROR_CODES.SDK.NETWORK ||
        code === ERROR_CODES.SDK.TIMEOUT
      ) {
        setInstagramState("LOADING");
        return;
      }
      // Unknown backend error (reachable, but not a state we recognize) — don't
      // block the user; treat as connected.
      setInstagramState("CONNECTED");
      return;
    }

    if (
      result.data?.alreadyHadSnapshot === false &&
      result.data?.snapshotQueued === true
    ) {
      setIsTakingSnapshot(true);
    }
    if (result.data?.instagram) updateInstagramData(result.data.instagram);
    setInstagramState("CONNECTED");
  }, [router, updateInstagramData]);

  // The full cold-start/retry resolution (moved here from the app shell so
  // retry surfaces — e.g. the share-create screen's "taking too long" button —
  // can re-run it without reaching into the layout). Commit to a definitive
  // state ONLY when we actually know it: a loaded customer with IG → probe; a
  // loaded customer without IG → NOT_LINKED. If the customer can't be loaded
  // (offline / transport failure, `reloadCustomer` → null), stay LOADING —
  // never guess NOT_LINKED just because we're offline, or the IG-gated nudges
  // (story-views modal, share-opportunity) would fire on a false "no Instagram".
  const resolveInstagramState = useCallback(async () => {
    try {
      const cust = await reloadCustomer();
      // `instagram !== null` ⇒ linked (CustomerMe dropped the redundant flag).
      if (cust?.instagram) {
        await getInstagramStatus();
      } else if (cust) {
        setInstagramState("NOT_LINKED");
      }
      // else: couldn't load the customer → leave LOADING (retried on resume /
      // via the retry affordance).
    } catch {
      // Unexpected throw — same rule: don't guess, stay LOADING.
    }
  }, [reloadCustomer, getInstagramStatus]);

  // Given an OAuth outcome, exchange the code (`POST /me/instagram/connect`) and
  // re-probe. Shared by the normal and incognito entry points. Returns whether
  // the caller should offer the incognito retry: `true` only when the OAuth flow
  // was cancelled / dismissed / errored (the login page stalled) — NOT for a
  // backend error like a wrong account (2214/4101), which incognito can't fix.
  const finishReconnect = useCallback(
    async (auth: AuthFlowResult): Promise<boolean> => {
      // OAuth didn't yield a code (cancel/dismiss/error) → offer the incognito
      // retry (the reliable fallback when Instagram's login page stalls).
      if (auth.type !== "success") return true;

      setInstagramState("LOADING");
      const result = await callAuthed(
        router,
        (jwt) => connectInstagram({ jwt, body: { code: auth.params.code } }),
        { suppressAlerts: true }
      );

      if (!result.ok) {
        const code = result.error?.error.code;
        // Wrong / already-taken IG account — explain why it didn't link.
        if (code === 2214 || code === 4101) {
          customAlert(
            t("connectFailedTitle"),
            code === 2214 ? t("alreadyLinked") : t("accountMismatch")
          );
        } else if (code === 4099) {
          // Linked, but the insights permission wasn't granted (a personal
          // account can't grant it at all) — open the explainer sheet: what
          // the permission is used for + a "connect again" CTA. The re-probe
          // below flips the prompt into its "fix permission" state meanwhile.
          setPermissionSheetOpen(true);
        } else {
          // Anything else (transient Instagram/backend failure, network) —
          // OAuth succeeded, so silence here would read as "nothing happened".
          customAlert(t("connectFailedTitle"), t("connectFailedBody"));
        }
        // Re-probe so the state reflects reality (handles 4099 / token errors).
        await getInstagramStatus();
        return false;
      }

      // Linked/refreshed — patch the cached profile, then probe to verify the
      // connection and queue an audience snapshot (sets CONNECTED).
      if (result.data?.instagram) updateInstagramData(result.data.instagram);
      // No snapshot yet (first-time link, or a reconnect of an account that never
      // got one) → the probe below will queue one, so reflect "taking snapshot"
      // immediately rather than waiting on the probe round-trip.
      if (result.data?.instagram && !result.data.instagram.hasSnapshot) {
        setIsTakingSnapshot(true);
      }
      await getInstagramStatus();
      return false;
    },
    [router, getInstagramStatus, updateInstagramData, setIsTakingSnapshot, t]
  );

  // Standard reconnect (shared-cookie browser). Resolves to `true` when the
  // caller should offer the incognito retry (a cancel/stall), so the retry stays
  // local to the prompt instance the user actually tapped.
  const reconnectInstagram = useCallback(
    async () => finishReconnect(await prompt()),
    [prompt, finishReconnect]
  );

  // Private-window reconnect — the reliable fallback when the standard flow
  // stalls (Instagram's login often hangs with a shared session).
  const reconnectInstagramIncognito = useCallback(
    async () => finishReconnect(await promptEphemeral()),
    [promptEphemeral, finishReconnect]
  );

  const value = useMemo(
    () => ({
      instagramState,
      setInstagramState,
      getInstagramStatus,
      resolveInstagramState,
      reconnectInstagram,
      reconnectInstagramIncognito,
      isTakingSnapshot,
      setIsTakingSnapshot,
    }),
    [
      instagramState,
      getInstagramStatus,
      resolveInstagramState,
      reconnectInstagram,
      reconnectInstagramIncognito,
      isTakingSnapshot,
    ]
  );

  return (
    <InstagramConnectionContext.Provider value={value}>
      {children}
      <InstagramPermissionSheet
        open={permissionSheetOpen}
        onClose={() => setPermissionSheetOpen(false)}
        onReconnect={() => {
          setPermissionSheetOpen(false);
          void reconnectInstagram();
        }}
      />
    </InstagramConnectionContext.Provider>
  );
};
