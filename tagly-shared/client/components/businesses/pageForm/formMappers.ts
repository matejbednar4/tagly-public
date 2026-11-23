import type { FormMedia } from "./StepMedia";
import type { PickedMedia } from "../../../services/media/pickMedia";
import type { Period, WeekHours } from "./StepDetails";

/**
 * Mapping helpers shared by every pageForm HOST (the advertiser edit screens,
 * the admin edit screens, the create wizard) — the glue between the wire
 * shapes and the form state. Kept here, next to the forms whose state they
 * translate, so no app re-implements them.
 */

/** One `openingHours` wire row (matches `OpeningHoursPeriodSchema`). */
export type OpeningHoursRow = {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
};

/** `openingHours` wire rows → the form's per-day {@link WeekHours} shape. */
export const toWeekHours = (periods: OpeningHoursRow[]): WeekHours => {
  const hours: WeekHours = {};
  for (const p of periods) {
    (hours[p.dayOfWeek] ??= []).push({
      open: p.openMinute,
      close: p.closeMinute,
    });
  }
  return hours;
};

/** The form's {@link WeekHours} → the flat `openingHours` wire rows. */
export const weekHoursToPeriods = (hours: WeekHours): OpeningHoursRow[] =>
  Object.entries(hours).flatMap(([day, dayPeriods]) =>
    ((dayPeriods ?? []) as Period[]).map((p) => ({
      dayOfWeek: Number(day),
      openMinute: p.open,
      closeMinute: p.close,
    })),
  );

/**
 * Compute a media edit's keep/add sets from the form state (keep-by-uid
 * semantics — remote entries are kept by uid and never re-uploaded, local
 * entries are the fresh picks to upload). Shared by the save gate (change
 * detection) and the commit (the actual media init/confirm bodies).
 */
export const diffFormMedia = (
  banner: FormMedia | null,
  photos: FormMedia[],
): {
  keepPhotoUids: string[];
  newPhotos: PickedMedia[];
  newBanner: PickedMedia | null;
} => {
  const keepPhotoUids = photos.flatMap((p) =>
    p.kind === "remote" ? [p.media.uid] : [],
  );
  const newPhotos = photos.flatMap((p) =>
    p.kind === "local" ? [p.media] : [],
  );
  const newBanner = banner?.kind === "local" ? banner.media : null;
  return { keepPhotoUids, newPhotos, newBanner };
};
