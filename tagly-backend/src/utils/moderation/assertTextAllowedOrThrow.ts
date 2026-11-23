import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { createCustomError } from "../core/errors/createCustomError.js";
import { CS_PROFANITY } from "../../constants/content/PROFANITY.js";

// English: obscenity's maintained dataset + recommended transformers
// (leet-speak, spacing tricks; word-boundary aware, so "Scunthorpe"-style
// false positives are avoided). Built once at module load.
const englishMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Czech: whole-word match on a lowercased, diacritics-stripped copy of the
// text against our curated list (see constants/content/PROFANITY.ts).
const csPattern = new RegExp(
  `(?:^|[^a-z0-9])(?:${CS_PROFANITY.join("|")})(?:$|[^a-z0-9])`,
);

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Rejects user-authored text that contains profanity or slurs (EN via the
 * `obscenity` dataset, CS via our curated list) with domain code **4951**
 * (422). Apply it to every advertiser-authored string surfaced in either app
 * (business name, description, search aliases, instagram handle, …) at the
 * write boundary. `fieldName` flavors the server-side message; `fieldKey` (a
 * stable machine key like `"description"`) rides the error's `errors[].path`
 * so clients can name the offending field in their own copy.
 */
export function assertTextAllowedOrThrow(
  text: string | null | undefined,
  fieldName: string,
  fieldKey?: string,
): void {
  if (!text) return;
  const normalized = stripDiacritics(text.toLowerCase());
  if (
    englishMatcher.hasMatch(text) ||
    englishMatcher.hasMatch(normalized) ||
    csPattern.test(normalized)
  ) {
    throw createCustomError(
      4951,
      `${fieldName} contains inappropriate language`,
      {
        status: 422,
        ...(fieldKey
          ? { errors: [{ path: fieldKey, message: "profanity" }] }
          : {}),
      },
    );
  }
}
