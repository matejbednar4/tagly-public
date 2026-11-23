import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { callAuthed } from "@tagly/client";
import { adminGetBusinessByUid } from "@tagly/sdk/v2/adminApp";
import type { AdminBusiness } from "@tagly/models/v2/adminApp";
import type { LocalSubaccountUid } from "@tagly/models/shared";

/**
 * Load one business (`GET /v2/admin/businesses/:uid`) once on mount — the
 * shared fetcher of the three business edit screens (each seeds its form from
 * the loaded value exactly once, so no refetching here; the detail screen does
 * its own focus-refetch).
 */
export function useAdminBusiness(uid: string | undefined) {
  const router = useRouter();
  const [business, setBusiness] = useState<AdminBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await callAuthed(
        router,
        (jwt) =>
          adminGetBusinessByUid({
            jwt,
            params: { uid: uid as LocalSubaccountUid },
          }),
        { suppressAlerts: true },
      );
      if (cancelled) return;
      if (res.ok && res.data) setBusiness(res.data.business);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return { business, loading };
}
