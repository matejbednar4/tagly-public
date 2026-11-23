import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  GetAllBusinessesBody,
  GetAllBusinessesResponse,
} from "@tagly/models/v2/customerApp";
import type { VerticalSlug } from "@tagly/models/shared";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { typeSlugsForVerticals } from "../../../../utils/businesses/discover/verticalMatching.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";

/**
 * `POST /v2/customers/businesses/all` — the paginated "browse all businesses"
 * directory behind the Discover shelves. **Accessible** businesses (visible ==
 * shareable) in the customer's market, hydrated with reward estimates.
 *
 * Sort: `"name"` (case-insensitive A→Z, default) or `"distance"` (nearest-first;
 * requires device coordinates — falls back to name sort without them).
 * `verticalSlugs` filters to those verticals (an unknown slug maps to no types →
 * empty page, never the whole directory). Offset pagination, mirroring the other
 * lists (`skip = offset * limit`; `hasMore` when a full page came back).
 */
export const getAllBusinesses: RequestHandler = asyncHandler(
  async (req, res) => {
    const {
      offset,
      limit,
      sort,
      verticalSlugs,
      currentLat,
      currentLon,
    } = req.validatedBody as GetAllBusinessesBody;
    const customerId = req.user.id;

    // Country scope (same market as search/recommended).
    const customer = await db
      .selectFrom("app.customers")
      .select("locale")
      .where("id", "=", customerId)
      .executeTakeFirst();

    const filteringByVertical = !!verticalSlugs && verticalSlugs.length > 0;
    const typeSlugs = filteringByVertical
      ? typeSlugsForVerticals(new Set(verticalSlugs as VerticalSlug[]))
      : [];

    let query = db
      .selectFrom("app.local_subaccounts as ls")
      .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
      .leftJoin("app.advertiser_types as at", "at.id", "ls.type_id")
      .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
      .leftJoin(
        "app.advertiser_sensitive_data as asd",
        "asd.id",
        "a.sensitive_data_id"
      )
      .select(["ls.id"])
      .$if(Boolean(customer?.locale), (qb) =>
        qb.where("addr.country_code", "=", customer!.locale)
      )
      // When a vertical filter is set, always apply it — an empty type-list
      // (unknown vertical) then returns nothing, never the whole directory.
      .$if(filteringByVertical, (qb) => qb.where("at.slug", "in", typeSlugs));

    query = applyBusinessAccessibleFilter(query);

    // Distance sort needs coordinates; otherwise (or for "name") sort A→Z.
    const useDistance =
      sort === "distance" &&
      currentLat !== undefined &&
      currentLon !== undefined;
    const sorted = useDistance
      ? query.orderBy(
          sql`ST_Distance(
            addr.location::geography,
            ST_SetSRID(ST_MakePoint(${currentLon}, ${currentLat}), 4326)::geography
          )`,
          "asc"
        )
      : query.orderBy(sql`lower(ls.name)`, "asc");

    const idRows = await applyOffsetPagination(sorted, { offset, limit }).execute();

    const hasMore = hasMoreFromPage(idRows.length, limit);

    const businesses =
      idRows.length === 0
        ? []
        : await hydrateBusinessPublicPreviews({
            businessIds: idRows.map((r) => r.id),
            customerId,
          });

    res.status(200).json({
      message: "Businesses fetched successfully",
      offset,
      hasMore,
      businesses,
    } satisfies GetAllBusinessesResponse);
  }
);
