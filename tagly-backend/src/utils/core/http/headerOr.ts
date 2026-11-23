/**
 * Read a request header as a single trimmed string, falling back when it's
 * absent or blank. Express types a header value as `string | string[]` (repeated
 * headers come through as an array); this takes the first entry and trims it.
 */
export function headerOr(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim() : fallback;
}
