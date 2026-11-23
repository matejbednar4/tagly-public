import { PROMO_DELIVERY } from "../../constants/notifications/PROMO_DELIVERY.js";

/**
 * Send-time math for promo notifications: timezone resolution + quiet-hours
 * snapping. Consumed by `queuePromoNotificationJobsOrReturn`, which stamps the
 * result into `NotificationQueue.scheduledAt`.
 *
 * Correct timezones are load-bearing here (a wrong zone = 3am nudges), so the
 * resolution is device-truth first and defensive throughout: every candidate
 * zone is validated against `Intl` before use, and any residual failure
 * degrades to "send at the earliest time" rather than throwing into the
 * scheduler.
 */

/** `Intl` accepts the IANA zone string. Cached — a batch repeats few zones. */
const tzValidity = new Map<string, boolean>();
function isValidTimeZone(timeZone: string): boolean {
  const cached = tzValidity.get(timeZone);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    ok = true;
  } catch {
    ok = false;
  }
  tzValidity.set(timeZone, ok);
  return ok;
}

/**
 * Resolve the zone to schedule a recipient's promo send in:
 *   1. `deviceTimezone` — the freshest active push token's device-reported
 *      IANA zone (both apps send `Intl…resolvedOptions().timeZone` on every
 *      app open, so this is ground truth whenever it exists)
 *   2. the recipient locale's market default (US→New York, CZ→Prague)
 *   3. `FALLBACK_TIMEZONE`
 */
export function resolvePromoTimezone(
  deviceTimezone: string | null | undefined,
  locale: string | null | undefined,
): string {
  if (deviceTimezone && isValidTimeZone(deviceTimezone)) return deviceTimezone;

  const byLocale =
    locale && locale in PROMO_DELIVERY.DEFAULT_TIMEZONE_BY_LOCALE
      ? PROMO_DELIVERY.DEFAULT_TIMEZONE_BY_LOCALE[
          locale as keyof typeof PROMO_DELIVERY.DEFAULT_TIMEZONE_BY_LOCALE
        ]
      : undefined;
  if (byLocale && isValidTimeZone(byLocale)) return byLocale;

  return PROMO_DELIVERY.FALLBACK_TIMEZONE;
}

/** Local wall-clock minutes-since-midnight of `date` in `timeZone`. */
function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/**
 * Stable seed for the snap jitter — one value per (recipient, step, channel)
 * so a re-queue or a send-time re-snap of the same leg lands on the same
 * moment, while different legs of the same morning spread apart.
 */
export function promoJitterSeed(
  target: string,
  recipientId: number,
  eventSlug: string,
  channel: string,
): string {
  return `${target}:${recipientId}:${eventSlug}:${channel}`;
}

/** FNV-1a 32-bit — cheap deterministic hash for the jitter offset. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Snap `earliest` into the recipient's local quiet-hours window [start, end):
 * inside → unchanged (anchor time preserved); before it → today's start; after
 * it → tomorrow's start. Snapped times additionally get a deterministic
 * `jitterSeed`-derived offset in [0, SNAP_JITTER_MS) so snapped sends spread
 * over the morning instead of stacking at exactly the window start.
 *
 * `spreadInWindow` (QUEUE-TIME callers only, E057): also offset an in-window
 * time by a deterministic [0, IN_WINDOW_SPREAD_MS) so a scheduler batch
 * stamped with one shared `base` doesn't come due as a single burst. The
 * send-time re-snap must NEVER pass it — re-snapping `now` forward would
 * defer every in-window send forever.
 *
 * Minute-precision offset math (a DST transition between now and the
 * target can shift the result by ±1h — fine for a marketing nudge). Never
 * throws: on any `Intl` failure it returns `earliest` unchanged (deliver-now
 * beats deliver-never).
 */
export function snapToQuietHours(
  earliest: Date,
  timeZone: string,
  jitterSeed?: string,
  opts?: { spreadInWindow?: boolean },
): Date {
  try {
    const current = localMinutes(earliest, timeZone);
    const start = PROMO_DELIVERY.QUIET_HOURS_START_LOCAL_HOUR * 60;
    const end = PROMO_DELIVERY.QUIET_HOURS_END_LOCAL_HOUR * 60;
    if (current >= start && current < end) {
      if (opts?.spreadInWindow && jitterSeed) {
        return new Date(
          earliest.getTime() +
            (hashSeed(jitterSeed) % PROMO_DELIVERY.IN_WINDOW_SPREAD_MS),
        );
      }
      return earliest;
    }
    const minutesUntilStart =
      current < start ? start - current : 24 * 60 - current + start;
    const jitterMs = jitterSeed
      ? hashSeed(jitterSeed) % PROMO_DELIVERY.SNAP_JITTER_MS
      : 0;
    return new Date(
      earliest.getTime() + minutesUntilStart * 60_000 + jitterMs,
    );
  } catch {
    return earliest;
  }
}
