import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@tagly/models/shared";
import type {
  SuggestLocaleBody,
  SuggestLocaleResponse,
} from "@tagly/models/v2/crossApp";
import { getCountryForTimezone } from "../../../utils/localization/getCountryForTimezone.js";

/**
 * `POST /v2/public/suggest-locale`. Pure locale derivation over the
 * `@tagly/models/v2/crossApp` schema + the shared derivation util.
 *
 * Returns `{ locale }` where `locale` is a `SupportedLocale` when both device
 * signals (timezone and device region string like `"en-US"`) were received AND
 * agree; otherwise `null`. A lone signal, a disagreement, or a missing signal
 * collapses to null so the frontend surfaces the locale picker — wrong silent
 * assignments cost more than an extra picker show.
 *
 * NOTE: there is no IP/geo signal. The backend runs on AWS App Runner (not
 * behind Cloudflare), so the `cf-ipcountry` header is never present; we rely on
 * the two device-reported signals only.
 *
 * Language is NOT returned by this endpoint. The frontend derives the
 * preferred language directly from device APIs (`Intl.DateTimeFormat()` on
 * web, `expo-localization` on RN) — there's no multi-signal logic for it, so
 * the round trip would add nothing.
 *
 * Unauthenticated. Frontend calls this only when an onboarding flow is about
 * to start (landing screen) — not for logged-in users, since established
 * accounts already have locale + language stored.
 *
 * No DB writes. Pure derivation; safe to call repeatedly.
 */
export const suggestLocale: RequestHandler = asyncHandler(async (req, res) => {
  const { timezone, deviceRegion } = req.validatedBody as SuggestLocaleBody;

  const votes: SupportedLocale[] = [];
  const tzVote = getCountryForTimezone(timezone);
  if (tzVote) votes.push(tzVote);
  const regionVote = normalizeLocaleCandidate(extractRegionPart(deviceRegion));
  if (regionVote) votes.push(regionVote);

  const distinct = new Set(votes);

  // Strict unanimity: commit to a guess only when both signals were received
  // and agree. A lone signal or a disagreement collapses to null so the client
  // surfaces the picker — wrong silent assignments cost more than a picker show.
  const locale: SupportedLocale | null =
    votes.length >= 2 && distinct.size === 1 ? votes[0]! : null;

  res.status(200).json({
    message: "Locale suggested",
    locale,
  } satisfies SuggestLocaleResponse);
});

function normalizeLocaleCandidate(
  raw: string | null | undefined,
): SupportedLocale | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (!upper) return null;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(upper)) {
    return upper as SupportedLocale;
  }
  return null;
}

/**
 * Extracts the region/country part from a BCP-47-ish region string.
 *   - `"US"` → `"US"`
 *   - `"en-US"` → `"US"`
 *   - `"cs-CZ"` → `"CZ"`
 *   - `"en"` → `"EN"` (no region; fails to normalize, treated as absent)
 */
function extractRegionPart(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split("-");
  return parts[parts.length - 1] ?? null;
}
