/**
 * Client-side "open now" for a business, computed live from its opening-hours
 * periods + IANA timezone so a stale boolean never gets baked into a cached
 * detail response. Shared by the customer business-details screen and the admin
 * business-detail screen — the one canonical implementation.
 *
 * Period semantics (matching `OpeningHoursPeriod` in `@tagly/models`):
 *   - dayOfWeek: 0 = Sunday … 6 = Saturday (matches JS `Date.getDay`)
 *   - openMinute / closeMinute: minutes from local midnight
 *   - closeMinute <= openMinute ⇒ the interval closes the next day (overnight)
 *   - closed days simply have no entry
 */

/** The minimal opening-hours interval shape this helper needs. */
export type OpeningHoursInterval = {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
};

/** Current weekday (0=Sun) + minutes-from-midnight in an IANA timezone, or null. */
function nowInTimezone(
  timeZone: string,
): { weekday: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const names: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const wd = names[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hour =
      Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (wd === undefined) return null;
    return { weekday: wd, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/** True/false if the business is open right now, or null if undeterminable. */
export function isBusinessOpenNow(
  periods: OpeningHoursInterval[],
  timeZone: string,
): boolean | null {
  const now = nowInTimezone(timeZone);
  if (!now) return null;
  const prevDay = (now.weekday + 6) % 7;
  for (const p of periods) {
    const overnight = p.closeMinute <= p.openMinute;
    if (p.dayOfWeek === now.weekday) {
      if (overnight) {
        if (now.minutes >= p.openMinute) return true; // open into tomorrow
      } else if (now.minutes >= p.openMinute && now.minutes < p.closeMinute) {
        return true;
      }
    }
    // An overnight interval that started yesterday and hasn't closed yet.
    if (p.dayOfWeek === prevDay && overnight && now.minutes < p.closeMinute) {
      return true;
    }
  }
  return false;
}
