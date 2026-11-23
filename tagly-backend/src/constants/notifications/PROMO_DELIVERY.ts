/**
 * Promo (marketing) delivery policy — quiet hours + the push→email waterfall.
 *
 * Quiet hours: promo sends are snapped into the recipient's LOCAL daytime
 * window so a nudge never lands at 3am. Timezone resolution
 * (`utils/queue/promoSendTime.ts`) is device-truth first and can
 * never throw: the freshest active push token's device-reported IANA zone →
 * the recipient locale's market default below → FALLBACK_TIMEZONE, with every
 * candidate validated against `Intl` before being trusted. All wall-clock
 * math goes through `Intl`, so DST is the platform's problem, not ours.
 *
 * Waterfall: a promo step offering PUSH + EMAIL is push-first — the email leg
 * is queued ESCALATION_DELAY_MS after the (snapped) push and skipped at send
 * time if the recipient opened the app since the push went out (see
 * `executeNotificationJob`). Recipients with no active push token get the
 * email immediately instead.
 */
export const PROMO_DELIVERY = {
  /** Local-time send window [start, end): 8:00–20:00 recipient-local. */
  QUIET_HOURS_START_LOCAL_HOUR: 8,
  QUIET_HOURS_END_LOCAL_HOUR: 20,

  /**
   * When a send is snapped to the window START (it fell in quiet hours), a
   * deterministic per-(recipient, step, channel) jitter inside [0, this) is
   * added so snapped sends spread over the morning instead of ALL landing at
   * exactly 8:00 — without it, a step's trailing email and the next step's
   * push systematically collide at the same instant. Sends already inside the
   * window keep their anchor time and get no jitter. Must stay well under the
   * window length (start + jitter must remain inside the window).
   */
  SNAP_JITTER_MS: 2 * 60 * 60 * 1000, // 2 hours

  /**
   * QUEUE-TIME-only spread for sends already INSIDE the window: a maintenance
   * scheduler pass stamps its whole batch with one `base` instant, so without
   * a spread thousands of rows come due at the same moment and the worker
   * fires them as one burst (E057). A small deterministic per-leg offset in
   * [0, this) de-stacks the batch. Deliberately small (a late-window base +
   * spread may slip past 20:00 and defer to next morning — rare and fine for
   * marketing), and NEVER applied by the send-time re-snap: re-snapping `now`
   * forward would defer every send forever.
   */
  IN_WINDOW_SPREAD_MS: 15 * 60 * 1000, // 15 minutes

  /** Push→email escalation gap on two-channel steps. */
  ESCALATION_DELAY_MS: 24 * 60 * 60 * 1000, // 24 hours

  /** Market-default zones for recipients with no device-reported timezone. */
  DEFAULT_TIMEZONE_BY_LOCALE: {
    US: "America/New_York", // home market: Tampa, FL
    CZ: "Europe/Prague",
  },

  /**
   * Last-resort zone when neither device nor locale gives one — i.e. a
   * recipient with no active push token AND a locale outside
   * DEFAULT_TIMEZONE_BY_LOCALE. Deliberately UTC rather than a market zone:
   * the fallback fires precisely when we do NOT know where the recipient is,
   * so guessing a market would assert something unknown. Any recipient whose
   * market we DO know is served by the map above, which is where a new market
   * gets added.
   */
  FALLBACK_TIMEZONE: "UTC",
} as const;
