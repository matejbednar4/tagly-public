// AWS Rekognition config — content moderation (block vocabulary/confidence) + share-text OCR matching.
// Consolidated from the former rekognition.ts + aws/rekognition.ts.

export const SHARE_TEXT_MATCH = {
  MIN_CONFIDENCE: 50,
};

/**
 * The moderation block vocabulary, as PATTERNS rather than exact AWS label
 * strings — matched against `"<ParentName> <Name>"` of every returned label.
 *
 * ## Why patterns and not a list of label names
 *
 * This used to be two exact-match sets (`REKOG_BLOCK_CATEGORIES` +
 * `REKOG_BLOCK_LABELS`) written against Rekognition's pre-v7 taxonomy. AWS
 * replaced that taxonomy wholesale in **moderation model v7**, and because
 * nothing in the code pinned or asserted a model version, the rename silently
 * disabled most of our moderation — the API kept returning 200s with labels we
 * simply no longer recognised (FINDINGS A-NEW14). Concretely: `explicit nudity`
 * became `Explicit`, `drugs` and `tobacco` merged into `Drugs & Tobacco`, and
 * `Swimwear or Underwear` appeared as a category that had never existed. Bikini
 * and drug imagery passed moderation for months.
 *
 * Patterns degrade gracefully where exact names cannot: a future rename that
 * keeps any recognisable word ("Drugs & Narcotics", "Explicit Content") still
 * matches. A rename that shares no word with the pattern will still slip
 * through — no client-side vocabulary can fully survive that — so treat a
 * Rekognition model upgrade as a change that REQUIRES re-testing this file
 * against real flagged images.
 *
 * ## One vocabulary, two jobs
 *
 * The same table drives BOTH the block decision and the `errors[].message` key
 * the client shows the user ("nudity", "drugs", …). They previously lived in
 * separate places and could disagree; keeping them together means a label can
 * never be blocked with no explanation, or explained but not blocked.
 *
 * ## Deliberate exclusions
 *
 * - **Alcohol is NOT blocked.** Tagly signs wineries, bars and breweries whose
 *   photos legitimately show drinks; they were being false-flagged. No pattern
 *   here matches the v7 `Alcohol` category, and none should be added.
 * - **`Rude Gestures` and `Visually Disturbing` are not blocked**, matching the
 *   pre-v7 behaviour.
 * - **Swimwear/underwear IS blocked** (see the entry below) — the one genuine
 *   policy call in this list rather than a taxonomy fix.
 */
export const REKOG_BLOCK_PATTERNS: readonly (readonly [RegExp, string])[] = [
  // v7: "Explicit", "Explicit Sexual Activity", "Non-Explicit Nudity of
  // Intimate parts and Kissing". Pre-v7: "Explicit Nudity", "Sexual Activity".
  [/nudity|sexual|\bsex\b|porn|explicit/, "nudity"],
  // v7 top-level category with no pre-v7 equivalent under this name.
  // ⚠️ POLICY CALL, not a taxonomy fix: a gym, spa or pool business may post
  // legitimate swimwear photos. Delete this one line to allow them.
  [/swimwear|underwear|lingerie/, "nudity"],
  [/violence|weapon|\bgun\b|knife|blood/, "violence"],
  [/self[-\s]?harm/, "selfHarm"],
  [/hate/, "hate"],
  // v7 merges drugs + tobacco into "Drugs & Tobacco"; children include
  // "Pills", "Drug Paraphernalia", "Smoking".
  [/drug|marijuana|cannabis|pills/, "drugs"],
  [/gambling/, "gambling"],
] as const;

/**
 * Returns the moderation category key for a label, or `null` when it is not
 * blocked. Permanent policy: what counts as a violation never differs between
 * versions, so every validator shares this one table.
 *
 * Matches on `"<ParentName> <Name>"` so BOTH top-level (L1) and child (L2/L3)
 * labels are covered. The old code read the category from `ParentName` alone,
 * which in v7 is EMPTY for top-level labels — so a clean top-level hit could
 * never match anything (the second half of A-NEW14).
 */
export function moderationBlockKey(
  parentName: string | undefined,
  name: string | undefined,
): string | null {
  const haystack = `${parentName ?? ""} ${name ?? ""}`.toLowerCase();
  return REKOG_BLOCK_PATTERNS.find(([re]) => re.test(haystack))?.[1] ?? null;
}

export const REKOG_MIN_CONFIDENCE_DEFAULT = 80;
