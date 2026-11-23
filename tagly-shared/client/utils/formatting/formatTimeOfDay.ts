import dayjs from "dayjs";

/**
 * Localized **time of day** from minutes-since-local-midnight. dayjs's global
 * locale is kept in sync with the app language in `i18n/index.ts`, so English
 * renders 12-hour ("9:00 AM") and Czech 24-hour ("9:00") — the same locale
 * signal `formatDate` uses, so dates and times stay consistent.
 *
 * Mirrors `formatDate`'s `dayjs.locale()` branch. A midnight value (1440) rolls
 * to the next day, reading "0:00" / "12:00 AM"; callers that mean a full day
 * (open 24h) handle that case before calling this.
 */
export function formatTimeOfDay(minutesFromMidnight: number): string {
  const t = dayjs().startOf("day").add(minutesFromMidnight, "minute");
  return dayjs.locale() === "cs" ? t.format("H:mm") : t.format("h:mm A");
}
