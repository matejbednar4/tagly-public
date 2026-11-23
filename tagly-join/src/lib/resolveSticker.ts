
// QR-sticker resolution: physical stickers in partner businesses carry URLs
// like https://join.tagly.cz/?utm_source=table-sticker&id=000001. We resolve
// the sticker id to its business via the public backend endpoint and use the
// result to personalize the landing. Any failure (unknown sticker, network,
// timeout, bad JSON) resolves to null and the page renders the generic landing.

export type StickerBusiness = {
  uid: string;
  name: string;
  referralCode: string | null;
};

const RESOLVE_TIMEOUT_MS = 2500;

/**
 * Validates the raw `?id=` query value. Accepts digit-only strings whose
 * numeric value is 1–999999 (e.g. "000001" or "123") and returns the
 * original (zero-padded) string, or null when invalid.
 */
export function parseStickerId(
  raw: string | string[] | undefined,
): string | null {
  // Sticker ids are OPAQUE strings used exactly as printed — no padding, no
  // case folding, no numeric interpretation ("000001" today, possibly random
  // ids like "yf5h8ayui21r" in future batches). Must stay in sync with
  // `@tagly/models` core/qrStickers `QrStickerIdSchema` (this standalone
  // project can't import it): trimmed, 1-64 chars, URL-safe charset. The
  // literal string flows to the resolve endpoint, the OneLink params, and
  // analytics unchanged.
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/**
 * Server-side fetch of GET <API_BASE>/v2/public/stickers/:id with a short
 * timeout. Never throws — returns null on any failure so the page falls back
 * to the generic landing.
 */
export async function resolveSticker(
  stickerId: string,
): Promise<StickerBusiness | null> {
  // Validated + inlined at build time in next.config.ts.
  const base = process.env.API_BASE_URL as string;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/v2/public/stickers/${stickerId}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const business = (json as { business?: unknown } | null)?.business;
    if (typeof business !== "object" || business === null) return null;

    const { uid, name, referralCode } = business as {
      uid?: unknown;
      name?: unknown;
      referralCode?: unknown;
    };
    if (typeof uid !== "string" || typeof name !== "string" || name === "") {
      return null;
    }

    return {
      uid,
      name,
      referralCode: typeof referralCode === "string" ? referralCode : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
