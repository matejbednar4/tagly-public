import dayjs from "dayjs";

/**
 * Localized **date only** (no time-of-day). dayjs's global locale is kept in sync
 * with the app language in `i18n/index.ts`, so Czech writes dates day-first
 * ("25. května 2024") and English keeps "May 25, 2024".
 *
 * The app never displays a time-of-day, so there is deliberately no datetime /
 * 12h-24h variant — date is the only granularity we render.
 */
export function formatDate(dateTimeStr: string) {
  const d = dayjs(dateTimeStr);
  return dayjs.locale() === "cs"
    ? d.format("D. MMMM YYYY")
    : d.format("MMM D, YYYY");
}
