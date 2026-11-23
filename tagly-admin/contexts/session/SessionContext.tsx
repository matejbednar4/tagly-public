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
  SHARED_SECURE_KEYS,
  setOnUnauthorized,
} from "@tagly/client";

interface SessionContextValue {
  /** The stored admin JWT, or null when logged out. Drives the root route guard. */
  jwt: string | null;
  /** False until the stored JWT has been read from SecureStore. */
  ready: boolean;
  /** Persist a JWT + clear the query cache. Flips the guard → (app). */
  signIn: (jwt: string) => Promise<void>;
  /** Clear the JWT + query cache. Flips the guard → (auth). */
  signOut: () => Promise<void>;
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
 * Owns "is there an admin JWT?" — the single signal the root layout's
 * `Stack.Protected` guards read to choose `(app)` vs `(auth)`. Must be mounted
 * inside `QueryClientProvider` (it clears the query cache on sign-in/out).
 *
 * Stripped-down twin of the customer's SessionProvider: bearer token only, no
 * push-token teardown and no onboarding cleanup (admin has none). Sign-out is
 * local (delete the token + clear cache) — bearer tokens are stateless; a
 * server-side revoke (bump `Admin.jwtVersion`) is a future `/v2/admin` endpoint.
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
    qc.clear();
    setJwt(newJwt); // flips the root guard → (app)
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await secureDelete(SHARED_SECURE_KEYS.JWT);
    setJwt(null); // flips the root guard → (auth)
  };

  // `callAuthed` triggers a real logout on a 401 / missing-JWT by calling the
  // callback registered here → `signOut` clears storage + cache and flips the
  // route guard in-session (no restart).
  useEffect(() => {
    setOnUnauthorized(() => {
      void signOut();
    });
    return () => setOnUnauthorized(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ jwt, ready, signIn, signOut }),
    // signIn/signOut close over stable refs (qc + setters); jwt/ready drive updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jwt, ready],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
