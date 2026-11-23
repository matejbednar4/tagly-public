import fs from "node:fs";
import path from "node:path";

export type LegalDoc =
  | "privacy-policy"
  | "terms-of-service"
  | "terms-of-monetization";

const LOCALE_TO_FILE: Record<string, string> = {
  en: "en.md",
  cs: "cs.md",
};

// The canonical legal documents live in the monorepo's tagly-legal/ folder
// (one folder per document, en.md + cs.md). Read them directly at build time —
// there is no site-local copy. See tagly-legal/CLAUDE.md for editing rules.
export function loadLegalDoc(lng: string, doc: LegalDoc): string {
  const file = LOCALE_TO_FILE[lng] ?? LOCALE_TO_FILE.en;
  return fs.readFileSync(
    path.join(process.cwd(), "..", "tagly-legal", doc, file),
    "utf8",
  );
}
