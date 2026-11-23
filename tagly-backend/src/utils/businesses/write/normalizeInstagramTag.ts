/**
 * Normalize a business's Instagram handle the same way the customer side does:
 * trimmed, no leading "@", lowercased. Empty in → null (no handle).
 */
export function normalizeInstagramTag(
  tag: string | null | undefined,
): string | null {
  return tag?.trim().replace(/^@+/, "").toLowerCase() || null;
}
