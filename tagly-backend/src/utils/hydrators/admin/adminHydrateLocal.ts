import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { mediaPreviewSelect } from "../../../prisma/selects/shared/common/media.preview.select.js";
import { addressWithIdSelect } from "../../../prisma/selects/shared/common/address.withId.select.js";
import { evaluateBusinessAccessibility } from "../../businesses/businessAccessibility.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { sharePaidSql } from "../../shares/shareAccess.js";
import { asBigInt } from "../../formatting/asBigInt.js";
import { ADMIN_APPROVED_SHARE_STATUS } from "../../shares/shareAccess.js";
import { sumAdvertiserCreditPurchasesCentsByAdvertiser } from "../../money/ledger/advertiserCreditPurchases.js";
import type { AdminBusinessInput } from "@tagly/models/v2/adminApp";
import type { SupportedLocale } from "@tagly/models/shared";

type LocalShareStats = {
  totalShares: number;
  totalSpendCents: number;
  averagePricePerShareCents: number;
  uniqueCustomers: number;
  totalReach: number;
};

const EMPTY_STATS: LocalShareStats = {
  totalShares: 0,
  totalSpendCents: 0,
  averagePricePerShareCents: 0,
  uniqueCustomers: 0,
  totalReach: 0,
};

/**
 * Batch share statistics per local, over APPROVED shares only (what the
 * advertiser actually sees / was charged for — the `filterAdminApprovedShares` gate,
 * applied in SQL). One query grouped by local_id.
 */
async function computeLocalShareStatistics(
  localIds: number[],
): Promise<Map<number, LocalShareStats>> {
  if (localIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("app.shares as s")
    .leftJoin("app.final_price as fp", "fp.share_id", "s.id")
    .leftJoin("app.share_insights as si", "si.share_id", "s.id")
    .select((eb) => [
      eb.ref("s.local_id").as("local_id"),
      sql<number>`CAST(COUNT(*) AS INT)`.as("total_shares"),
      sql<number>`CAST(COUNT(DISTINCT s.customer_id) AS INT)`.as(
        "unique_customers",
      ),
      sql<number>`COALESCE(SUM(COALESCE(si.reach,0)),0)::int`.as("total_reach"),
      sql<number>`CAST(COUNT(*) FILTER (WHERE ${sharePaidSql("s")}) AS INT)`.as(
        "paid_count",
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents), 0)::text`.as(
        "total_spend_cents_all",
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents) FILTER (WHERE ${sharePaidSql("s")}), 0)::text`.as(
        "paid_sum_cents",
      ),
    ])
    .where("s.local_id", "in", localIds)
    .where("s.approval_status", "=", ADMIN_APPROVED_SHARE_STATUS)
    .groupBy("s.local_id")
    .execute();

  const result = new Map<number, LocalShareStats>();

  for (const row of rows) {
    const paidCount = row.paid_count ?? 0;
    const totalSpendCentsBig = asBigInt(row.total_spend_cents_all);
    const paidSumCentsBig = asBigInt(row.paid_sum_cents);

    result.set(row.local_id!, {
      totalShares: row.total_shares ?? 0,
      uniqueCustomers: row.unique_customers ?? 0,
      totalReach: row.total_reach ?? 0,
      totalSpendCents: Number(totalSpendCentsBig),
      averagePricePerShareCents:
        paidCount > 0 ? Number(paidSumCentsBig / BigInt(paidCount)) : 0,
    });
  }

  for (const id of localIds) {
    if (!result.has(id)) result.set(id, { ...EMPTY_STATS });
  }

  return result;
}

export default async function adminHydrateLocal(
  opts: { localId: number } | { localIds: number[] },
): Promise<AdminBusinessInput[]> {
  const ids = "localId" in opts ? [opts.localId] : opts.localIds;
  if (ids.length === 0) return [];

  const locals = await prisma.localSubaccount.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      uid: true,
      name: true,
      description: true,
      banner: { select: mediaPreviewSelect },
      photos: { select: mediaPreviewSelect },
      type: { select: { slug: true } },
      // timezone drives the client-side "open now" for openingHours.
      address: {
        // + countryCode: the admin edit screens derive the page's market
        // (US/CZ region list, country lock) from it.
        select: { ...addressWithIdSelect, timezone: true, countryCode: true },
      },
      status: true,
      tags: true,
      instagramTag: true,
      contactEmail: true,
      phoneNumber: true,
      // Admins see the link status too (customers only ever get APPROVED urls).
      websiteLink: { select: { url: true, status: true } },
      reservationLink: { select: { url: true, status: true } },
      menuLink: { select: { url: true, status: true } },
      // Ordered for stable rendering (Sun→Sat, earliest interval first).
      openingHours: {
        select: { dayOfWeek: true, openMinute: true, closeMinute: true },
        orderBy: [{ dayOfWeek: "asc" as const }, { openMinute: "asc" as const }],
      },
      createdAt: true,
      updatedAt: true,
      advertiser: {
        select: {
          id: true,
          uid: true,
          email: true,
          locale: true,
          sensitiveData: {
            select: {
              availableBudgetUsdCents: true,
              lockedBudgetUsdCents: true,
            },
          },
        },
      },
      subsidizationPeriods: {
        select: { startedAt: true, endedAt: true },
        orderBy: { startedAt: "asc" as const },
      },
    },
  });

  if (locals.length === 0) return [];

  const localsById = new Map(locals.map((l) => [l.id, l]));

  // Batch coordinates via PostGIS.
  const addressIds = Array.from(new Set(locals.map((l) => l.address.id)));
  const coordRows = await db
    .selectFrom("app.addresses as a")
    .select((eb) => [
      eb.ref("a.id").as("id"),
      sql<number>`ST_Y((a.location)::geometry)`.as("lat"),
      sql<number>`ST_X((a.location)::geometry)`.as("lon"),
      sql<number | null>`ST_Y((a.city_location)::geometry)`.as("city_lat"),
      sql<number | null>`ST_X((a.city_location)::geometry)`.as("city_lon"),
    ])
    .where("a.id", "in", addressIds)
    .execute();

  const coords = new Map<
    number,
    { lat: number; lon: number; cityLat: number | null; cityLon: number | null }
  >();
  for (const r of coordRows) {
    if (r.lat == null || r.lon == null) {
      throw createCustomError(4460, `Address ${r.id} has no valid location`, 500);
    }
    coords.set(r.id, {
      lat: r.lat,
      lon: r.lon,
      cityLat: r.city_lat ?? null,
      cityLon: r.city_lon ?? null,
    });
  }

  // Lifetime credit purchases per owning advertiser — ledger-derived, one
  // groupBy for the whole batch.
  const advertiserIds = Array.from(
    new Set(
      locals
        .map((l) => l.advertiser?.id)
        .filter((id): id is number => id != null),
    ),
  );
  const [statsMap, accessibilityMap, creditPurchasesByAdvertiser] =
    await Promise.all([
      computeLocalShareStatistics(ids),
      evaluateBusinessAccessibility(ids),
      sumAdvertiserCreditPurchasesCentsByAdvertiser(advertiserIds),
    ]);

  return ids.map((id) => {
    const l = localsById.get(id);
    if (!l) {
      throw createCustomError(4462, `No local found for id ${id}`, 404);
    }

    const c = coords.get(l.address.id);
    if (!c) {
      throw createCustomError(
        4461,
        `No location found for address ${l.address.id}`,
        500,
      );
    }

    const accessibility = accessibilityMap.get(id);
    if (!accessibility) {
      throw createCustomError(4463, `No accessibility for local ${id}`, 500);
    }

    const stats = statsMap.get(id)!;
    const {
      id: _id,
      // timezone lifts to the top level; the rest form the GeoAddress.
      address: { id: _addrId, timezone, ...addressFields },
      advertiser: adv,
      type,
      ...rest
    } = l;

    return {
      // ...rest carries the contact fields, the three web links, and
      // openingHours straight through — their shapes already match the DTO.
      ...rest,
      timezone,
      type: { slug: type.slug },
      address: { ...addressFields, location: { lat: c.lat, lon: c.lon } },
      cityLocation:
        c.cityLat != null && c.cityLon != null
          ? { lat: c.cityLat, lon: c.cityLon }
          : null,
      accessibility,
      advertiser: adv
        ? {
            uid: adv.uid,
            email: adv.email,
            // Writer-guaranteed supported (narrowed at registration); read as-is.
            locale: adv.locale as SupportedLocale,
            availableBudgetUsdCents: adv.sensitiveData.availableBudgetUsdCents,
            lockedBudgetUsdCents: adv.sensitiveData.lockedBudgetUsdCents,
            totalCreditPurchasesUsdCents:
              creditPurchasesByAdvertiser.get(adv.id) ?? 0n,
          }
        : null,
      // Derived from the same accessibility evaluation (single source of truth).
      isSubsidized: accessibility.facts.hasOpenSubsidizationPeriod,
      subsidizedShareCount: accessibility.facts.subsidizedShareCount,
      statistics: stats,
    };
  });
}
