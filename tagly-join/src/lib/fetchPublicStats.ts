/**
 * Server-side fetch of GET <API_BASE>/v2/public/stats. Cached by Next's data
 * cache for 5 minutes so tagly-join traffic doesn't fan out per view. Never
 * throws — on any failure it returns null and the hero's social-proof chip
 * renders a skeleton pill in the number's slot (see page.tsx) until a later
 * fetch succeeds.
 *
 * The count is rendered exactly as returned. There used to be a
 * `socialProofDisplayCount` helper that floored it to a marketing step
 * ("2,547" -> "2,500"); it was dropped deliberately, so the chip now shows the
 * live figure and moves as the number does.
 */
export async function fetchCustomerCount(): Promise<number | null> {
  // Validated + inlined at build time in next.config.ts.
  const base = process.env.API_BASE_URL as string;
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
    const count =
      typeof data === "object" && data !== null
        ? (data as { customerCount?: unknown }).customerCount
        : undefined;
    return typeof count === "number" && Number.isFinite(count) && count >= 0
      ? count
      : null;
  } catch {
    return null;
  }
}
