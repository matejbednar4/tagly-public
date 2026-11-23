export type PublicStats = {
  customerCount: number;
  /** Null when the API doesn't return it yet — the backend gained this
   *  counter in the same change as this page, so until that deploy lands the
   *  hero shows the customer chip alone. */
  businessCount: number | null;
};

/**
 * Server-side fetch of GET <API_BASE_URL>/v2/public/stats — the live counters
 * behind the landing hero's social-proof chips. Cached by Next's data cache
 * for 5 minutes (same as tagly-join) so site traffic doesn't fan out per view.
 *
 * Never throws, and `API_BASE_URL` is deliberately OPTIONAL (unlike
 * tagly-join, which hard-requires it): with the var missing, unreachable, or
 * the payload malformed this returns null and the hero simply renders without
 * the chips. The landing page must never fail to build or render because the
 * API is down.
 *
 * The var is inlined at build time by `next.config.ts` (`env`), because the
 * landing page renders per request on Amplify compute, which doesn't reliably
 * expose runtime env vars — see the `force-dynamic` note in
 * `src/app/[lng]/page.tsx` for why that page can't be prerendered.
 */
export async function fetchPublicStats(): Promise<PublicStats | null> {
  const base = process.env.API_BASE_URL?.replace(/\/+$/, "");
  if (!base) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${base}/v2/public/stats`, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });

    clearTimeout(timer);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return null;
    const { customerCount, businessCount } = data as {
      customerCount?: unknown;
      businessCount?: unknown;
    };
    const isCount = (v: unknown): v is number =>
      typeof v === "number" && Number.isFinite(v) && v >= 0;
    if (!isCount(customerCount)) return null;
    return {
      customerCount,
      businessCount: isCount(businessCount) ? businessCount : null,
    };
  } catch {
    return null;
  }
}
