import prisma from "../../../prisma/prisma.js";
import type { BusinessPublicPreview } from "@tagly/models/v2/customerApp";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { addressWithIdSelect } from "../../../prisma/selects/shared/common/address.withId.select.js";
import {
  getBusinessSubsidizedStatuses,
  evaluateBusinessAccessibility,
  businessVisibleWhere,
} from "../../businesses/businessAccessibility.js";
import { isLowBudgetEstimate } from "../../pricing/calculateEstPrice.js";
import { getEstPricesCached } from "../../pricing/getEstPricesCached.js";

/**
 * Hydrates a set of businesses (local subaccounts) into `BusinessPublicPreview`
 * for the customer map/search. Preserves the input id order (the caller sorts by
 * distance). Reads the address lat/lon via PostGIS (the geometry column isn't a
 * plain Prisma field).
 *
 * `isAccessible` is resolved per business from the canonical rule
 * (`evaluateBusinessAccessibility`) — tautologically true for listing-sourced
 * ids (those queries filter on `businessAccessibleSql`), but the detail read,
 * the visited list, and a share's embedded business are visibility-only, so
 * the flag is what lets the client hide/replace its "Earn here" CTAs instead
 * of dead-ending at createShare's 4003.
 * `isSubsidizedByPlatform` is resolved per business via `businessAccessibility`.
 *
 * The reward estimate (`estimatedRewardCents` / `estimatedAverageReach` /
 * `rewardMessageSlugs`) is computed per business via `calculateEstPrice`, keyed
 * to the requesting `customerId` (their past-share reach / follower count drives
 * it; the no-IG reach fallback is the server-owned Customer.estimatedStoryViews,
 * read inside the pricer — E062).
 *
 * Never throws on stored-data issues (per the hydrators rule): a business whose
 * address has no readable coordinates is **skipped**, not fatal — one bad row
 * can't 500 the whole map region.
 */
export default async function hydrateBusinessPublicPreviews(opts: {
  businessIds: number[];
  customerId: number;
}): Promise<BusinessPublicPreview[]> {
  // Defense-in-depth: the customer-visibility gate is enforced HERE as well as
  // in the callers' queries — a DELETED/BANNED id slipping in is silently
  // dropped, never hydrated for a customer.
  const businesses = await prisma.localSubaccount.findMany({
    where: { id: { in: opts.businessIds }, ...businessVisibleWhere },
    select: {
      id: true,
      uid: true,
      name: true,
      banner: {
        select: { uid: true, key: true, aspectRatio: true, type: true },
      },
      type: { select: { slug: true } },
      address: { select: addressWithIdSelect },
    },
  });

  if (businesses.length === 0) return [];

  const byId = new Map(businesses.map((b) => [b.id, b]));
  const subsidized = await getBusinessSubsidizedStatuses(opts.businessIds);
  // Canonical accessibility per business (one batched query). A missing row
  // (deleted mid-flight) degrades to false — worst case a CTA is hidden.
  const accessibility = await evaluateBusinessAccessibility(opts.businessIds);
  const addressIds = Array.from(new Set(businesses.map((b) => b.address.id)));

  const rows = await db
    .selectFrom("app.addresses as a")
    .select((eb) => [
      eb.ref("a.id").as("id"),
      sql<number>`ST_Y((a.location)::geometry)`.as("lat"),
      sql<number>`ST_X((a.location)::geometry)`.as("lon"),
    ])
    .where("a.id", "in", addressIds)
    .execute();

  const coords = new Map<number, { lat: number; lon: number }>();
  for (const r of rows) {
    // Skip (don't throw) an address with unreadable coordinates — degrade so one
    // bad row can't break the whole region fetch.
    if (r.lat == null || r.lon == null) continue;
    coords.set(r.id, { lat: r.lat, lon: r.lon });
  }

  // Resolvable = exists + has readable coordinates. Compute estimates only for
  // those (the rest get dropped from the response below).
  const resolvableIds = opts.businessIds.filter((id) => {
    const b = byId.get(id);
    return b != null && coords.has(b.address.id);
  });

  // Price all resolvable businesses in one batch, through the Redis read-through
  // cache (keyed per customer+business generation; misses fall through to
  // calculateEstPrices, which fetches the customer-level inputs once). isSubsidized
  // is resolved inside the pricer.
  const estimatesById = await getEstPricesCached({
    customerId: opts.customerId,
    localIds: resolvableIds,
  });

  // Preserve the input (distance-sorted) order; drop any business we couldn't
  // resolve coordinates for.
  return opts.businessIds.flatMap((id) => {
    const b = byId.get(id);
    if (!b) return [];
    const c = coords.get(b.address.id);
    if (!c) return [];

    const { id: _id, ...safe } = b;
    const est = estimatesById.get(id);
    const isRewardCapped = est?.isRewardCapped ?? false;
    // Hot-deal / scarcity flag — the canonical derivation (never true for
    // subsidized/PAYG; see isLowBudgetEstimate).
    const isLowBudget = isLowBudgetEstimate(est);
    return [
      {
        ...safe,
        // Explicit preview pick — the select now fetches the full address, but
        // the preview wire stays {city, street, location} (drops id/country/region/zip).
        address: { city: safe.address.city, street: safe.address.street, location: c },
        isAccessible: accessibility.get(id)?.isAccessible ?? false,
        isSubsidizedByPlatform: subsidized.get(id) ?? false,
        estimatedRewardCents:
          est && est.reward !== null ? Number(est.reward) : null,
        estimatedAverageReach: est?.averageReach ?? null,
        rewardMessageSlugs: est?.messageSlugs ?? [],
        isRewardCapped,
        isLowBudget,
      },
    ];
  });
}
