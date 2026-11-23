import { z } from "zod";

/**
 * One opening-hours interval for a business, interpreted in the business's local
 * timezone (`BusinessPublicDetails.timezone`). A business's hours are an array
 * of these:
 *   - splits    → multiple entries for the same `dayOfWeek` (e.g. 11:00–14:00
 *                 and 17:00–22:00)
 *   - overnight → `closeMinute <= openMinute` means the interval closes the next
 *                 day (e.g. a bar open 17:00 → 02:00 is open=1020, close=120)
 *   - 24 hours  → openMinute=0, closeMinute=1440
 *   - closed    → simply no entry for that weekday
 *
 * "Open now" is computed client-side from these entries + the timezone, so it
 * stays live and never bakes a stale boolean into the cached detail response.
 */
/** Up to 3 intervals per weekday (split hours, e.g. breakfast/lunch/dinner) × 7. */
export const MAX_OPENING_HOURS_PERIODS = 21;

export const OpeningHoursPeriodSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday … 6 = Saturday (matches JS Date.getDay)
  openMinute: z.number().int().min(0).max(1439), // minutes from local midnight
  closeMinute: z.number().int().min(1).max(1440), // minutes from local midnight; <= openMinute ⇒ next day
});

export type OpeningHoursPeriod = z.infer<typeof OpeningHoursPeriodSchema>;
