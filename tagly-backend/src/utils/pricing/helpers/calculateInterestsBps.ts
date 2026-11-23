import {
  advertiserTypeBySlug,
  interestBySlug,
  type AdvertiserTypeSlug,
  type InterestSlug,
  type VerticalSlug,
} from "@tagly/models/shared";
import { getInterestTypeWeightBps } from "../../../constants/catalogs/weights/interestsToAdvertiserTypesCatalog.js";
import { getVerticalToVerticalWeightBps } from "../../../constants/catalogs/weights/verticalToVerticalCatalog.js";
import { INTERESTS_BOUNDS } from "../../../constants/rewards/multipliers/INTERESTS.js";

const ONE_X = 10_000;

// Interest→Type exact/close > best Vertical↔Vertical > 1.00x
function resolveInterestMatchBps(
  interestSlug: InterestSlug,
  typeSlug: AdvertiserTypeSlug
): number {
  const direct = getInterestTypeWeightBps(interestSlug, typeSlug);
  if (typeof direct === "number") return direct;

  const interest = interestBySlug.get(interestSlug);
  const type = advertiserTypeBySlug.get(typeSlug);
  if (!interest || !type) return ONE_X;

  let best: number | null = null;

  for (const iVert of interest.verticalSlugs as VerticalSlug[]) {
    for (const tVert of type.verticalSlugs as VerticalSlug[]) {
      const bps = getVerticalToVerticalWeightBps(iVert, tVert);
      if (typeof bps === "number") {
        if (best === null || bps > best) best = bps;
      }
    }
  }

  return typeof best === "number" ? best : ONE_X;
}

// Evaluate up to 3 interests and take the best BPS.
function bestInterestMatchForType(
  interestSlugs: InterestSlug[],
  typeSlug: AdvertiserTypeSlug
): number {
  if (!interestSlugs || interestSlugs.length === 0) return ONE_X;

  let best = ONE_X;
  const top = interestSlugs.slice(0, 3);

  for (const i of top) {
    const bps = resolveInterestMatchBps(i, typeSlug);
    if (bps > best) best = bps;
  }

  return best;
}

export function calculateInterestsBps({
  local,
  customer,
}: {
  local: { type: { slug: string } } | null;
  customer: { interests: { slug: string }[] } | null;
}): number {
  const typeSlug = local?.type.slug as AdvertiserTypeSlug | undefined;
  if (!typeSlug) return ONE_X;

  const interestSlugs = (customer?.interests ?? [])
    .map((i) => i.slug as InterestSlug)
    .slice(0, 3);
  if (interestSlugs.length === 0) return ONE_X;

  const raw = bestInterestMatchForType(interestSlugs, typeSlug);
  const clamped = Math.min(
    INTERESTS_BOUNDS.maxBps,
    Math.max(INTERESTS_BOUNDS.minBps, raw)
  );

  return clamped;
}
