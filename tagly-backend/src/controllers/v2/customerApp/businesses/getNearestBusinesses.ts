import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  GetNearestBusinessesQuery,
  GetNearestBusinessesResponse,
} from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { DISCOVER } from "../../../../constants/businesses/DISCOVER.js";

/**
 * `GET /v2/customers/businesses/nearest` — the "Near you" Discover shelf. Pure
 * proximity: the **accessible** businesses (visible == shareable) closest to the
 * **device location**, hydrated with reward estimates. No market filter (it's
 * spatial — wherever the user is), no taste/vertical filter (Recommended's job)
 * and no audience-location ranking (Earn-the-most's job) — just closest.
 *
 * The device location (`currentLat`/`currentLon`) is required and there is NO
 * fallback to audience locations: "near you" must mean near the user's actual
 * position. The client only calls this when location permission was granted, and
 * hides the shelf otherwise.
 */
export const getNearestBusinesses: RequestHandler = asyncHandler(
  async (req, res) => {
    const { currentLat, currentLon } =
      req.validatedQuery as GetNearestBusinessesQuery;
    const customerId = req.user.id;

    // No market filter — "near you" is purely spatial: wherever the user is, the
    // closest accessible businesses appear (only search + recommended are
    // market-scoped; MostPaying is filtered out by geo naturally).
    let query = db
      .selectFrom("app.local_subaccounts as ls")
      .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
      .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
      .leftJoin(
        "app.advertiser_sensitive_data as asd",
        "asd.id",
        "a.sensitive_data_id"
      )
      .select(["ls.id"]);

    query = applyBusinessAccessibleFilter(query);

    const idRows = await query
      .orderBy(
        sql`ST_Distance(
          addr.location::geography,
          ST_SetSRID(ST_MakePoint(${currentLon}, ${currentLat}), 4326)::geography
        )`,
        "asc"
      )
      .limit(DISCOVER.SHELF_LIMIT)
      .execute();

    if (idRows.length === 0) {
      res.status(200).json({
        message: "Nearest businesses fetched successfully",
        businesses: [],
      } satisfies GetNearestBusinessesResponse);
      return;
    }

    const businesses = await hydrateBusinessPublicPreviews({
      businessIds: idRows.map((r) => r.id),
      customerId,
    });

    res.status(200).json({
      message: "Nearest businesses fetched successfully",
      businesses,
    } satisfies GetNearestBusinessesResponse);
  }
);
