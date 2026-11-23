import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "expo-router";
import { callAuthed } from "@tagly/client";
import { adminGetMe } from "@tagly/sdk/v2/adminApp";
import type { AdminGetMeResponse } from "@tagly/models/v2/adminApp";

interface AdminContextValue {
  /** The signed-in admin's profile (uid, email, username, role), or null while loading / on error. */
  admin: AdminGetMeResponse | null;
  /** True during the initial `/v2/admin/me` fetch. */
  loading: boolean;
  /** Re-fetch the profile (e.g. after a retry). */
  reload: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return ctx;
}

/**
 * Loads + holds the authenticated admin (`GET /v2/admin/me`) for the `(app)`
 * group. A 401 flows through `callAuthed` → the session's unauthorized callback,
 * which signs out and flips the root guard back to `(auth)`; a transient/network
 * failure leaves `admin` null (screens can offer a retry via `reload`).
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminGetMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await callAuthed(router, (jwt) => adminGetMe({ jwt }), {
      suppressAlerts: true,
    });
    if (result.ok && result.data) setAdmin(result.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<AdminContextValue>(
    () => ({ admin, loading, reload }),
    [admin, loading, reload],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}
