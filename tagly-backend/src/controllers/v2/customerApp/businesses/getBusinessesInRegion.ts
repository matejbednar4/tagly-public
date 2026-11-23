import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  GetBusinessesInRegionQuery,
  GetBusinessesInRegionResponse,
} from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { MAP } from "@tagly/models/shared";

/**
 * `GET /v2/customers/businesses/in-region` — **accessible** businesses whose pin
 * falls inside the SW/NE bounding box, nearest-to-center first, capped at
 * `MAP.MAX_LOCALS_IN_REGION`. Accessibility (visible == shareable) is gated by
 * `businessAccessibleSql` (budget / PAYG / subsidization), so every returned
 * business is shareable.
 */
export const getBusinessesInRegion: RequestHandler = asyncHandler(
  async (req, res) => {
    const { SWlat, SWlon, NElat, NElon } =
      req.validatedQuery as GetBusinessesInRegionQuery;
    const customerId = req.user.id;

    const minLat = Math.min(SWlat, NElat);
    const maxLat = Math.max(SWlat, NElat);
    const minLon = Math.min(SWlon, NElon);
    const maxLon = Math.max(SWlon, NElon);
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

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
      .where(
        sql<boolean>`
          ST_Intersects(
            ${sql.ref("addr.location")},
            ST_MakeEnvelope(
              ${minLon}::double precision, ${minLat}::double precision,
              ${maxLon}::double precision, ${maxLat}::double precision,
              4326
            )
          )
        `
      );

    query = applyBusinessAccessibleFilter(query);

    const idRows = await query
      .orderBy(
        sql`ST_Distance(
          ${sql.ref("addr.location")},
          ST_SetSRID(ST_MakePoint(${centerLon}::double precision, ${centerLat}::double precision), 4326)
        )`,
        "asc"
      )
      .limit(MAP.MAX_LOCALS_IN_REGION)
      .execute();

    const isCapped = idRows.length === MAP.MAX_LOCALS_IN_REGION;

    if (idRows.length === 0) {
      res.status(200).json({
        message: "Businesses in region fetched successfully",
        businesses: [],
        isCapped: false,
      } satisfies GetBusinessesInRegionResponse);
      return;
    }

    const businesses = await hydrateBusinessPublicPreviews({
      businessIds: idRows.map((r) => r.id),
      customerId,
    });

    res.status(200).json({
      message: "Businesses in region fetched successfully",
      businesses,
      isCapped,
    } satisfies GetBusinessesInRegionResponse);
  }
);
