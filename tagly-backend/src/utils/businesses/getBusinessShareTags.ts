/**
 * The set of names a customer's Instagram story can show to validate a share for a
 * business: the business **name**, the advertiser's **alternative names**, and the
 * business's Instagram **handle** (as `@handle`). At least one must appear in the
 * story.
 *
 * ⚠️ The `tags` field is NOT keyword/category tags ("coffee", "pizza"). It is a
 * list of OTHER names the business goes by — used when its Instagram display name,
 * map-marker / Google name, or an old/abbreviated name differs from the `name`
 * entered in the app. Treat every entry as a business name, never a category.
 *
 * This is the single source of truth shared by:
 *  - the Rekognition text matcher (what it checks the story against), and
 *  - the customer-facing business-detail screen (what it displays as "show one of
 *    these in your story").
 *
 * Order is preserved (name, then tags, then handle) and entries are de-duplicated
 * case-insensitively. Note the matcher normalizes each entry (lowercase, strips
 * leading punctuation, etc.), so `@handle` and `handle` collapse to the same token
 * there — we expose the `@handle` form for display.
 */
export function getBusinessShareTags(local: {
  name: string;
  tags: string[];
  instagramTag: string | null;
}): string[] {
  const out: string[] = [local.name, ...(local.tags ?? [])];

  if (local.instagramTag) {
    const handle = local.instagramTag.replace(/^@+/, "").trim();
    if (handle) out.push(`@${handle}`);
  }

  const seen = new Set<string>();
  return out
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
