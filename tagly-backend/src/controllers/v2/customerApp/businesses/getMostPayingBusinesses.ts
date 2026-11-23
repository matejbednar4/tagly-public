import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type { GetMostPayingBusinessesResponse } from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { shareLiveSql } from "../../../../utils/shares/shareAccess.js";
import { getTopAudienceLocations } from "../../../../utils/businesses/discover/getTopAudienceLocations.js";
import { DISCOVER } from "../../../../constants/businesses/DISCOVER.js";

/**
 * `GET /v2/customers/businesses/top-earning` — the "Earn the most" Discover
 * shelf. Geography is the dominant reward multiplier, so candidate selection is
 * geo-first: gather the **accessible** businesses closest to the customer's top
 * Instagram audience locations (where their followers are), bounded to
 * `TOP_EARNING_CANDIDATE_LIMIT`. We then price that whole bounded set with the
 * reward hydrator and return the highest-earning ones.
 *
 * Interests are intentionally NOT a selection filter: the interest/demographics
 * multipliers already live inside the per-business reward, so pricing the closest
 * candidates and sorting by reward ranks them correctly without a separate
 * pre-filter. Geo already caps how many we price, so we never price "everything."
 * (If a market ever holds far more than the candidate limit within range, a
 * farther high-interest business could fall outside the closest-N pull — revisit
 * with an interest-aware cut then.)
 *
 * Businesses the customer already shared in the last 24h are excluded: a repeat
 * post to the same business within 24h gets a 0× frequency multiplier
 * (calculateFrequencyBps), so they'd earn 0 and don't belong on this shelf.
 *
 * No snapshot → no audience locations → empty list (the client hides the shelf
 * and shows the "rewards calculating" notice). Defense-in-depth: the client also
 * skips calling this when `CustomerMe.instagram.hasSnapshot` is false.
 */
export const getMostPayingBusinesses: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const topLocations = await getTopAudienceLocations(
      customerId,
      DISCOVER.TOP_EARNING_AUDIENCE_LOCATIONS
    );

    // No snapshot (or no resolvable audience locations) → nothing to rank by.
    if (topLocations.length === 0) {
      res.status(200).json({
        message: "Top-earning businesses fetched successfully",
        businesses: [],
      } satisfies GetMostPayingBusinessesResponse);
      return;
    }

    const radiusM = DISCOVER.TOP_EARNING_CANDIDATE_RADIUS_KM * 1000;
    // Accept a candidate if it's near ANY of the top audience locations; rank by
    // distance to the NEAREST of them (geo is the dominant reward multiplier).
    const withinAnyLocation = sql<boolean>`(${sql.join(
      topLocations.map(
        (p) =>
          sql`ST_DWithin(addr.location::geography, ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326)::geography, ${radiusM})`
      ),
      sql` OR `
    )})`;
    const distanceToNearest = sql<number>`LEAST(${sql.join(
      topLocations.map(
        (p) =>
          sql`ST_Distance(addr.location::geography, ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326)::geography)`
      ),
      sql`, `
    )})`;

    // Exclude businesses the customer already posted about in the last 24h: a
    // repeat share to the same business within 24h gets a 0× frequency multiplier
    // (calculateFrequencyBps), so its reward is 0. Matches that check by using
    // posted_to_ig_at and a now-anchored 24h window.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let query = db
      .selectFrom("app.local_subaccounts as ls")
      .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
      .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
      .leftJoin(
        "app.advertiser_sensitive_data as asd",
        "asd.id",
        "a.sensitive_data_id"
      )
      .select(["ls.id"])
      // No market filter — the audience-location radius already keeps results in
      // the customer's geography, and geo is the dominant reward multiplier.
      .where(withinAnyLocation)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("app.shares as s24")
              .select("s24.id")
              .whereRef("s24.local_id", "=", "ls.id")
              .where("s24.customer_id", "=", customerId)
              .where("s24.posted_to_ig_at", ">=", dayAgo)
              // Only a LIVE recent share hides the business — a rejected/voided
              // one doesn't block a fresh share, so it shouldn't hide discovery
              // (matches createShare's dedup gate).
              .where(shareLiveSql("s24"))
          )
        )
      );

    query = applyBusinessAccessibleFilter(query);

    // Closest-to-audience first, bounded to the pricing budget — this is the set
    // we hand to the hydrator to price.
    const idRows = await query
      .orderBy(distanceToNearest, "asc")
      .limit(DISCOVER.TOP_EARNING_CANDIDATE_LIMIT)
      .execute();

    if (idRows.length === 0) {
      res.status(200).json({
        message: "Top-earning businesses fetched successfully",
        businesses: [],
      } satisfies GetMostPayingBusinessesResponse);
      return;
    }

    const candidates = await hydrateBusinessPublicPreviews({
      businessIds: idRows.map((r) => r.id),
      customerId,
    });

    // Price-rank: highest estimated reward first (nulls last — a snapshot exists
    // here, so nulls only arise from un-priceable rows, e.g. bad coords).
    const businesses = candidates
      .slice()
      .sort(
        (a, b) => (b.estimatedRewardCents ?? -1) - (a.estimatedRewardCents ?? -1)
      )
      .slice(0, DISCOVER.SHELF_LIMIT);

    res.status(200).json({
      message: "Top-earning businesses fetched successfully",
      businesses,
    } satisfies GetMostPayingBusinessesResponse);
  }
);
