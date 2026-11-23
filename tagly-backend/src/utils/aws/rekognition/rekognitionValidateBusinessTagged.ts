/**
 * Rekognition business-tag validator (v2).
 *
 * Detects whether a business's **name**, **alternative names**, or **@handle**
 * appear as text in a story image, using AWS Rekognition `DetectText`. Given an S3
 * key and a local subaccount id, it pulls the business's matchable names via
 * `getBusinessShareTags` (name + alternative names + @handle — the `tags` field is
 * OTHER names the business goes by, NOT keyword/category tags), runs OCR on the
 * image, and scores the detected words/lines against every name, returning the
 * best match as a classification + the raw scores.
 *
 * ── Strict (v2) ──
 * The bar is "a contiguous chunk of detected text closely matches one whole
 * name/handle" — NOT "a single word loosely resembling part of a name". Concretely:
 *  - The primary signal is the full-string similarity of a *whole* name/@handle
 *    against detected lines / sliding word-windows (so a single coincidental word
 *    can't pass — short names effectively require an exact match).
 *  - A secondary path passes a *multi-word* name that's mostly present (≥66% of its
 *    words, ≥2 of them), covering a partly-shown name — but a lone word never qualifies.
 *  - Each candidate name is scored & classified **coherently** (its own coverage +
 *    string score), then the best classification wins — signals are never mixed
 *    across different names.
 *  - High OCR confidence floor, tight token fuzz, and NO prefix matching.
 *
 * The create-share controller accepts only `PASS_STRONG` / `PASS_SOFT` and throws
 * 4100 ("Story doesn't clearly tag this business") otherwise (so `SUSPECT` is a
 * rejection — kept distinct only for observability).
 *
 * Imports only from other utils, environment, and the prisma client. (The
 * permanent `SHARE_TEXT_MATCH` confidence constant is intentionally NOT used:
 * this gate uses its own stricter floor below.)
 */

import { DetectTextCommand } from "@aws-sdk/client-rekognition";
import { envVariables } from "../../../environment/envVariables.js";
import { rekognitionClient } from "../../clients/aws/rekognition.js";
import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { getBusinessShareTags } from "../../businesses/getBusinessShareTags.js";

/** Tunable strictness knobs (v2-only; raising these makes the gate stricter). */
const STRICT = {
  /** Rekognition OCR confidence floor (stricter than the permanent SHARE_TEXT_MATCH of 50). */
  MIN_CONFIDENCE: 80,
  /** Per-token fuzzy floor for the coverage path (no prefix matching). */
  TOKEN_SIM: 0.9,
  /** A whole name/@handle appears near-verbatim as a contiguous chunk. */
  STRONG_STRING: 0.9,
  /** A whole name/@handle appears contiguously, with OCR/typo slack. */
  SOFT_STRING: 0.8,
  /** Borderline single near-miss → SUSPECT (rejected by the controller). */
  SUSPECT_STRING: 0.72,
  /** Multi-word name partly shown: fraction of its words that must appear… */
  PARTIAL_COVERAGE: 0.66,
  /** …and at least this many words, so a lone common word can never pass. */
  PARTIAL_MIN_HITS: 2,
} as const;

export type BusinessTagValidationClassification =
  | "PASS_STRONG"
  | "PASS_SOFT"
  | "SUSPECT"
  | "FAIL";

export type BusinessTagValidationResult = {
  classification: BusinessTagValidationClassification;
  coverage: number;
  bestScore: number;
  coreHits: number;
};

type Params = {
  s3Key: string;
  localId: number;
};

export async function rekognitionValidateBusinessTagged(
  params: Params,
): Promise<BusinessTagValidationResult> {
  const { s3Key, localId } = params;

  const local = await prisma.localSubaccount.findUnique({
    where: { id: localId },
    select: { tags: true, name: true, instagramTag: true },
  });
  if (!local) throw createCustomError(4040, "Local subaccount not found", 404);

  // Candidate names: business name + alternative names + @handle (single source of
  // truth, shared with the customer-facing detail screen).
  const names = getBusinessShareTags(local);

  // OCR the image.
  const response = await rekognitionClient.send(
    new DetectTextCommand({
      Image: { S3Object: { Bucket: envVariables.S3_BUCKET, Name: s3Key } },
    }),
  );

  // Keep only high-confidence detections, split into WORD / LINE.
  const rawWords: string[] = [];
  const rawLines: string[] = [];
  for (const d of response.TextDetections ?? []) {
    if (!d.DetectedText || d.Confidence == null) continue;
    if (d.Confidence < STRICT.MIN_CONFIDENCE) continue;
    if (d.Type === "WORD") rawWords.push(d.DetectedText);
    else if (d.Type === "LINE") rawLines.push(d.DetectedText);
  }

  return scoreStoryAgainstNames(names, rawWords, rawLines);
}

/**
 * Pure scorer (no I/O) — exported so the matching rules can be unit-tested without
 * Rekognition or the DB. Normalizes the candidate names + raw detected WORD/LINE
 * strings, then classifies each name coherently and returns the best.
 */
export function scoreStoryAgainstNames(
  rawNames: string[],
  rawDetectedWords: string[],
  rawDetectedLines: string[],
): BusinessTagValidationResult {
  const fail: BusinessTagValidationResult = {
    classification: "FAIL",
    coverage: 0,
    bestScore: 0,
    coreHits: 0,
  };

  const names = rawNames
    .map((t) => normalizeString(t, { keepSpaces: true }))
    .filter(Boolean)
    .map((raw) => ({ raw, tokens: tokenizeBusinessName(raw) }))
    .filter((c) => c.tokens.length > 0);

  const detectedWordTokens = rawDetectedWords
    .flatMap((w) => normalizeString(w).split(/\s+/))
    .filter(Boolean);
  const detectedLineStrings = rawDetectedLines
    .map((l) => normalizeString(l, { keepSpaces: true }))
    .filter(Boolean);

  if (names.length === 0) return fail;
  if (detectedWordTokens.length === 0 && detectedLineStrings.length === 0) {
    return fail;
  }

  const RANK: Record<BusinessTagValidationClassification, number> = {
    FAIL: 0,
    SUSPECT: 1,
    PASS_SOFT: 2,
    PASS_STRONG: 3,
  };

  let best = fail;
  for (const { raw, tokens } of names) {
    const { coverage, coreHits } = scoreBusinessMatch(tokens, detectedWordTokens);
    const bestScore = findBestFullStringScore({
      business: raw,
      canonicalTokens: tokens,
      wordTokens: detectedWordTokens,
      lineStrings: detectedLineStrings,
    });
    const classification = classifyName({
      tokenCount: tokens.length,
      coverage,
      coreHits,
      bestScore,
    });
    if (RANK[classification] > RANK[best.classification]) {
      best = { classification, coverage, bestScore, coreHits };
    }
  }
  return best;
}

// Normalizes strings for matching
function normalizeString(raw: string, opts?: { keepSpaces?: boolean }): string {
  const keepSpaces = opts?.keepSpaces === true;

  let s = raw.toLowerCase().trim();

  // Remove typical ellipsis variants
  s = s.replace(/…/g, "");
  s = s.replace(/\.\.\.$/g, "");

  // Strip leading/trailing non-alphanumeric
  if (keepSpaces) {
    s = s.replace(/^[^\p{L}\p{N}]+/gu, "");
    s = s.replace(/[^\p{L}\p{N}\s]+$/gu, "");
  } else {
    s = s.replace(/^[^\p{L}\p{N}]+/gu, "");
    s = s.replace(/[^\p{L}\p{N}]+$/gu, "");
  }

  // Strip diacritics
  s = s.normalize("NFD").replace(/\p{M}+/gu, "");

  if (!keepSpaces) {
    s = s.replace(/\s+/g, "");
  } else {
    s = s.replace(/\s+/g, " ");
  }

  return s;
}

function tokenizeBusinessName(normalizedBusiness: string): string[] {
  return normalizedBusiness
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    // Drop pure-punctuation tokens (e.g. a standalone "&") so they don't dilute coverage.
    .filter((t) => /[\p{L}\p{N}]/u.test(t));
}

// Scores how many canonical tokens are matched by detected tokens
function scoreBusinessMatch(
  canonicalTokens: string[],
  detectedTokens: string[],
): { coverage: number; coreHits: number } {
  if (canonicalTokens.length === 0) {
    return { coverage: 0, coreHits: 0 };
  }

  let coreHits = 0;
  for (const ct of canonicalTokens) {
    if (detectedTokens.some((dt) => tokenMatches(ct, dt))) coreHits += 1;
  }

  return { coverage: coreHits / canonicalTokens.length, coreHits };
}

// Finds best similarity for full strings (lines + windows of tokens)
function findBestFullStringScore(params: {
  business: string;
  canonicalTokens: string[];
  wordTokens: string[];
  lineStrings: string[];
}): number {
  const { business, canonicalTokens, wordTokens, lineStrings } = params;

  if (!business) return 0;

  let best = 0;

  // Compare against entire LINEs
  for (const line of lineStrings) {
    const score = similarity(business, line);
    if (score > best) best = score;
  }

  // Compare against sliding windows of WORD tokens (so the name can be found
  // contiguously inside longer detected text).
  if (wordTokens.length > 0) {
    const maxWindow = Math.max(1, canonicalTokens.length + 1);

    for (let start = 0; start < wordTokens.length; start += 1) {
      for (
        let len = 1;
        len <= maxWindow && start + len <= wordTokens.length;
        len += 1
      ) {
        const window = wordTokens.slice(start, start + len).join(" ");
        const score = similarity(business, window);
        if (score > best) best = score;
      }
    }
  }

  return best;
}

// Token-level match: exact or tight fuzzy only. (No prefix matching — that let a
// short name match any word sharing its first few letters, e.g. "loud" → "lou".)
function tokenMatches(canonical: string, detected: string): boolean {
  if (!canonical || !detected) return false;
  if (canonical === detected) return true;
  return similarity(canonical, detected) >= STRICT.TOKEN_SIM;
}

// Levenshtein distance
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;

  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }

  return dp[n];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Classify ONE candidate name against the detections. The story passes only when
 * it clearly shows that whole name/@handle (or most of a multi-word name).
 */
function classifyName(p: {
  tokenCount: number;
  coverage: number;
  coreHits: number;
  bestScore: number;
}): BusinessTagValidationClassification {
  const { tokenCount, coverage, coreHits, bestScore } = p;

  // A contiguous chunk of detected text closely matches this whole name/@handle.
  if (bestScore >= STRICT.STRONG_STRING) return "PASS_STRONG";
  if (bestScore >= STRICT.SOFT_STRING) return "PASS_SOFT";

  // Most of a MULTI-word name is present (covers a partly-shown / reordered name).
  // Requires ≥2 matched words, so a single coincidental word never qualifies.
  if (
    tokenCount >= 2 &&
    coreHits >= STRICT.PARTIAL_MIN_HITS &&
    coverage >= STRICT.PARTIAL_COVERAGE
  ) {
    return "PASS_SOFT";
  }

  // A single near-miss (e.g. a short name vs a similar word) — rejected, kept
  // distinct from FAIL only for observability.
  if (bestScore >= STRICT.SUSPECT_STRING) return "SUSPECT";

  return "FAIL";
}
