const SAMPLE_LIMIT = 10;

/**
 * Formats an array of ids/uids for a log line: first N, then a "(+K more)"
 * count. Shared by every worker that logs a claimed/picked batch.
 */
export function sampleIds(ids: Array<number | string>): string {
  const head = ids.slice(0, SAMPLE_LIMIT);
  const more = Math.max(ids.length - head.length, 0);
  return more > 0 ? `${head.join(", ")} (+${more} more)` : head.join(", ");
}
