import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  secureGet,
  secureStore,
  secureDelete,
  localDelete,
  getExpoTokenIfGranted,
  SHARED_SECURE_KEYS,
  SHARED_LOCAL_KEYS,
  setOnUnauthorized,
} from "@tagly/client";
import { logOut as logOutReq } from "@tagly/sdk/v2/crossApp";
import { SECURE_KEYS, LOCAL_KEYS } from "@/constants/storageKeys";

interface SessionContextValue {
  /** The stored session JWT, or null when logged out. Drives the root route guard. */
  jwt: string | null;
  /** False until the stored JWT has been read from SecureStore. */
  ready: boolean;
  /** Persist a JWT + clear onboarding-scoped temp state. Flips the guard → (app). */
  signIn: (jwt: string) => Promise<void>;
  /** Clear the JWT + query cache. Flips the guard → (onboarding). */
  signOut: () => Promise<void>;
  /**
   * Persist a rotated JWT (e.g. after revoking other sessions) and update state —
   * no query-cache clear or onboarding cleanup, since the user stays signed in.
   */
  refreshJwt: (jwt: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}

/**
 * Owns "is there a JWT?" — the single signal the root layout's `Stack.Protected`
 * guards read to choose `(app)` vs `(onboarding)`. Must be mounted inside
 * `QueryClientProvider` (it clears the query cache on sign-in/out).
 *
 * Advertiser mirror of the customer's SessionContext, minus the customer-only
 * onboarding temp keys (Instagram/story-views). The `signIn` cleanup drops the
 * registration resume token so a future re-onboard starts clean.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [jwt, setJwt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await secureGet(SHARED_SECURE_KEYS.JWT);
        setJwt(stored ?? null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = async (newJwt: string) => {
    await secureStore(SHARED_SECURE_KEYS.JWT, newJwt);
    // Registration is finished — drop the resume token + the onboarding-scoped
    // temp flags so a future re-onboard (after logout) starts clean and re-asks
    // the push priming step.
    await secureDelete(SECURE_KEYS.REGISTRATION_TOKEN);
    await localDelete(LOCAL_KEYS.PUSH_PROMPTED);
    // The captured referrer code has now been consumed by attach-referrer (or was
    // never usable) — drop it so it can never be attached to a DIFFERENT account
    // that registers on this device later. The customer app does the same.
    await localDelete(SHARED_LOCAL_KEYS.REFERRAL_PREFILL);
    qc.clear();
    setJwt(newJwt); // flips the root guard → (app)
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    // Server-side half of logout: disable THIS device's push token (so a
    // logged-out phone stops receiving this account's notifications) before we
    // drop the JWT. Best-effort + fire-and-forget with the captured token —
    // logout must never block or fail on it. Called directly (not via callAuthed)
    // so an expired-JWT logout can't recurse into the 401 → signOut handler. Uses
    // the non-prompting token getter: logout must never trigger a permission prompt.
    const jwt = await secureGet(SHARED_SECURE_KEYS.JWT);
    if (jwt) {
      const pushToken =
        (await getExpoTokenIfGranted().catch(() => null)) ?? undefined;
      void logOutReq({ jwt, body: { pushToken } }).catch(() => {});
    }
    await secureDelete(SHARED_SECURE_KEYS.JWT);
    // Drop the account-scoped device flags: the step-overline baseline and the
    // setup-step dismissals belong to the account that wrote them — a different
    // account logging in next must not inherit them.
    await localDelete(LOCAL_KEYS.SETUP_STEP_BASE);
    await localDelete(LOCAL_KEYS.PAYMENT_SETUP_DISMISSED);
    await localDelete(LOCAL_KEYS.BUSINESS_SETUP_DISMISSED);
    await localDelete(LOCAL_KEYS.CREATE_BUSINESS_DRAFT);
    setJwt(null); // flips the root guard → (onboarding)
  };

  const refreshJwt = async (newJwt: string) => {
    // Swap the stored token in place (used after rotating jwtVersion). No cache
    // clear / cleanup: the session continues, only the token value changes.
    await secureStore(SHARED_SECURE_KEYS.JWT, newJwt);
    setJwt(newJwt);
  };

  // `callAuthed` (not a component, so it can't touch this state) triggers a real
  // logout on a 401 / missing-JWT by calling the callback registered here →
  // `signOut` clears storage + cache and flips the route guard in-session, no
  // restart. signOut closes over stable refs (qc + setters), so registering the
  // mount-time instance is safe.
  useEffect(() => {
    setOnUnauthorized(() => {
      void signOut();
    });
    return () => setOnUnauthorized(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ jwt, ready, signIn, signOut, refreshJwt }),
    // signIn/signOut close over stable refs (qc + setters); jwt/ready drive updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jwt, ready],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
