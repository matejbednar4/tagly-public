/**
 * "Oct 1" / "1. října" — the monthly-budget charge date as the app shows it
 * (the "How you pay" monthly row and `MonthlyTopUpSheet`).
 * The run is on the 1st in UTC terms (backend `CHARGE_HOUR_UTC`), so the UTC
 * calendar day is the day to show — local-tz rendering would say "the 31st"
 * on the US West Coast. Degrades to "" on a missing/malformed value
 * so a caller can simply hide the line.
 */
export function formatChargeDate(
  iso: string | null | undefined,
  language: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(language.startsWith("cs") ? "cs-CZ" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
