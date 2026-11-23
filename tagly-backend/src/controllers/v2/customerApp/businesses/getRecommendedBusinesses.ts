import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  GetRecommendedBusinessesQuery,
  GetRecommendedBusinessesResponse,
} from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import prisma from "../../../../prisma/prisma.js";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import { applyBusinessAccessibleFilter } from "../../../../utils/businesses/businessAccessibility.js";
import { getCustomerSharedVerticals } from "../../../../utils/businesses/discover/getCustomerSharedVerticals.js";
import {
  verticalsForInterests,
  typeSlugsForVerticals,
} from "../../../../utils/businesses/discover/verticalMatching.js";
import { DISCOVER } from "../../../../constants/businesses/DISCOVER.js";

/**
 * `GET /v2/customers/businesses/recommended` — the "Recommended for you" Discover
 * shelf. Selects **accessible** businesses (visible == shareable) in the
 * customer's market whose business type belongs to a vertical the customer cares
 * about — the union of their declared interests and the verticals they've already
 * shared into. Ordered nearest-first (to the device location when provided) and
 * hydrated with reward estimates.
 *
 * No taste signal (no interests AND no shares) → there is NO matched query: we do
 * NOT fall back to a nearest query, because that would just mirror the separate
 * "Near you" shelf. Such a customer falls straight through to the backfill.
 *
 * Variety + backfill: with a device location the matched candidates are a nearest
 * *pool* we shuffle + sample; without one they're a random sample across ALL
 * matches — either way the shelf isn't identical every visit. If it's short
 * (sparse interests) — or empty (cold start) — we top it up to the shelf size with
 * RANDOM accessible businesses in the customer's market, so it never looks
 * half-empty and never duplicates "Near you".
 */
export const getRecommendedBusinesses: RequestHandler = asyncHandler(
  async (req, res) => {
    const { currentLat, currentLon } =
      req.validatedQuery as GetRecommendedBusinessesQuery;
    const customerId = req.user.id;

    // Taste signal: declared interests ∪ verticals from past shares.
    const [customer, sharedVerticals] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { locale: true, interests: { select: { slug: true } } },
      }),
      getCustomerSharedVerticals(customerId),
    ]);

    const targetVerticals = verticalsForInterests(
      (customer?.interests ?? []).map((i) => i.slug)
    );
    for (const v of sharedVerticals) targetVerticals.add(v);
    const interestTypeSlugs = typeSlugsForVerticals(targetVerticals);

    let businessIds: number[] = [];

    // Matched shelf — ONLY when there's a taste signal. We deliberately don't run
    // a nearest query on cold start; that would just duplicate the "Near you"
    // shelf. No taste signal → `matched` stays empty and the random backfill below
    // fills the whole shelf.
    if (interestTypeSlugs.length > 0) {
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
        // Same market only (a CZ customer is recommended CZ businesses, etc.).
        .$if(Boolean(customer?.locale), (qb) =>
          qb.where("addr.country_code", "=", customer!.locale)
        )
        .where("at.slug", "in", interestTypeSlugs);

      query = applyBusinessAccessibleFilter(query);

      if (currentLat !== undefined && currentLon !== undefined) {
        // Located: nearest candidate pool → Fisher-Yates shuffle → take the
        // shelf's worth, so it stays local but isn't identical every visit.
        const idRows = await query
          .orderBy(
            sql`ST_Distance(
              addr.location::geography,
              ST_SetSRID(ST_MakePoint(${currentLon}, ${currentLat}), 4326)::geography
            )`,
            "asc"
          )
          .limit(DISCOVER.RECOMMENDED_CANDIDATE_POOL)
          .execute();
        const matched = idRows.map((r) => r.id);
        for (let i = matched.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matched[i], matched[j]] = [matched[j], matched[i]];
        }
        businessIds = matched.slice(0, DISCOVER.SHELF_LIMIT);
      } else {
        // No location to rank by → random sample across ALL matches (no arbitrary
        // DB-order pool); fully rotates and stays relevant via the vertical filter.
        const idRows = await query
          .orderBy(sql`random()`)
          .limit(DISCOVER.SHELF_LIMIT)
          .execute();
        businessIds = idRows.map((r) => r.id);
      }
    }

    // Backfill the remainder — or, on cold start, the whole shelf — with RANDOM
    // accessible businesses in the customer's market. Random (not nearest) so it
    // never mirrors the "Near you" shelf, and market-scoped to match the rest.
    if (businessIds.length < DISCOVER.SHELF_LIMIT) {
      let filler = db
        .selectFrom("app.local_subaccounts as ls")
        .leftJoin("app.addresses as addr", "addr.id", "ls.address_id")
        .leftJoin("app.advertisers as a", "a.id", "ls.advertiser_id")
        .leftJoin(
          "app.advertiser_sensitive_data as asd",
          "asd.id",
          "a.sensitive_data_id"
        )
        .select(["ls.id"])
        .$if(Boolean(customer?.locale), (qb) =>
          qb.where("addr.country_code", "=", customer!.locale)
        );
      if (businessIds.length > 0) {
        filler = filler.where("ls.id", "not in", businessIds);
      }
      filler = applyBusinessAccessibleFilter(filler);
      const fillerRows = await filler
        .orderBy(sql`random()`)
        .limit(DISCOVER.SHELF_LIMIT - businessIds.length)
        .execute();
      businessIds = [...businessIds, ...fillerRows.map((r) => r.id)];
    }

    if (businessIds.length === 0) {
      res.status(200).json({
        message: "Recommended businesses fetched successfully",
        businesses: [],
      } satisfies GetRecommendedBusinessesResponse);
      return;
    }

    const businesses = await hydrateBusinessPublicPreviews({
      businessIds,
      customerId,
    });

    res.status(200).json({
      message: "Recommended businesses fetched successfully",
      businesses,
    } satisfies GetRecommendedBusinessesResponse);
  }
);
