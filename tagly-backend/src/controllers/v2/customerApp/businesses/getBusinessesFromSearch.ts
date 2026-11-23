import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  GetBusinessesFromSearchQuery,
  GetBusinessesFromSearchResponse,
} from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";

/**
 * `GET /v2/customers/businesses/search` — global, case-insensitive business-name
 * search (no radius gate) over **accessible** businesses (visible == shareable,
 * gated by `businessAccessibleSql`), scoped to the customer's own market: only
 * businesses whose country (`address.country_code`) matches the customer's
 * `locale` (both ISO alpha-2). Sorted by proximity to the given coordinates when
 * provided (a sort hint only — never excludes), capped at 8 results.
 */
export const getBusinessesFromSearch: RequestHandler = asyncHandler(
  async (req, res) => {
    const { q, currentLat, currentLon } =
      req.validatedQuery as GetBusinessesFromSearchQuery;
    const customerId = req.user.id;

    // Country scope: a CZ customer only searches CZ businesses, US only US, etc.
    // `address.country_code` is the business-country source of truth (present even
    // for subsidized businesses, which have no advertiser); `customer.locale` is
    // the customer's ISO alpha-2 market.
    const customer = await db
      .selectFrom("app.customers")
      .select("locale")
      .where("id", "=", customerId)
      .executeTakeFirst();

    const base = applyBusinessAccessibleFilter(
      db
        .selectFrom("app.local_subaccounts as ls")
        .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
        .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
        .leftJoin(
          "app.advertiser_sensitive_data as asd",
          "asd.id",
          "a.sensitive_data_id"
        )
        .select(["ls.id"])
        .where(sql<boolean>`ls.name ILIKE ${"%" + q + "%"}`)
        .$if(Boolean(customer?.locale), (qb) =>
          qb.where("addr.country_code", "=", customer!.locale)
        )
    );

    const ordered =
      currentLat !== undefined && currentLon !== undefined
        ? base.orderBy(
            sql`
              ST_Distance(
                addr.location::geography,
                ST_SetSRID(ST_MakePoint(${currentLon}, ${currentLat}), 4326)::geography
              )
            `
          )
        : base;

    const idRows = await ordered.limit(8).execute();

    if (idRows.length === 0) {
      res.status(200).json({
        message: "Businesses matching search fetched successfully",
        businesses: [],
      } satisfies GetBusinessesFromSearchResponse);
      return;
    }

    const businesses = await hydrateBusinessPublicPreviews({
      businessIds: idRows.map((r) => r.id),
      customerId,
    });

    res.status(200).json({
      message: "Businesses matching search fetched successfully",
      businesses,
    } satisfies GetBusinessesFromSearchResponse);
  }
);
