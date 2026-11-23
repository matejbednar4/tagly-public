import prisma from "../../../prisma/prisma.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import type { BusinessOwnerDetails } from "@tagly/models/v2/advertiserApp";
import { businessOwnerVisibleWhere } from "../../businesses/businessAccessibility.js";
import { getBusinessShareTags } from "../../businesses/getBusinessShareTags.js";

/**
 * Hydrates one of the advertiser's own businesses into `BusinessOwnerDetails`
 * for the owner-facing detail screen. The owner twin of the customer's
 * `hydrateBusinessPublicDetails`, without the reward projection: identity +
 * banner + gallery + full address (+ map location) + contact/links + timezone +
 * opening hours.
 *
 * Differs from the customer hydrator in two owner-appropriate ways:
 *  - **No reward estimate / preview** — the owner isn't a potential sharer.
 *  - **Raw links** — the owner sees exactly what they entered (any moderation
 *    status), not the customer's APPROVED-only view.
 *
 * The address lat/lon is read via PostGIS (the geometry column isn't a plain
 * Prisma field). Returns null when the business row is gone or its coordinates
 * are unreadable (per the hydrators rule: degrade, never throw) so the caller
 * can 404. Ownership is enforced by the caller (the controller filters by
 * advertiserId).
 *
 * Defense-in-depth: the owner-visibility gate (`businessOwnerVisibleWhere` —
 * BANNED stays owner-visible, DELETED is gone) is enforced HERE as well as in
 * the controllers, so a future caller that forgets the filter returns null
 * (404) instead of resurrecting a deleted page.
 */
export default async function hydrateBusinessOwnerDetails(opts: {
  businessId: number;
}): Promise<BusinessOwnerDetails | null> {
  const row = await prisma.localSubaccount.findFirst({
    where: { id: opts.businessId, ...businessOwnerVisibleWhere },
    select: {
      uid: true,
      name: true,
      status: true,
      instagramTag: true,
      tags: true,
      description: true,
      phoneNumber: true,
      contactEmail: true,
      // Owner view: surface the raw url + moderation status regardless of
      // whether it's APPROVED (the customer view is the one that gates on
      // APPROVED and hides the rest).
      websiteLink: { select: { url: true, status: true } },
      reservationLink: { select: { url: true, status: true } },
      menuLink: { select: { url: true, status: true } },
      banner: {
        select: { uid: true, key: true, aspectRatio: true, type: true },
      },
      type: { select: { slug: true } },
      address: {
        select: {
          id: true,
          country: true,
          city: true,
          region: true,
          zip: true,
          street: true,
          timezone: true,
        },
      },
      photos: {
        select: { uid: true, key: true, aspectRatio: true, type: true },
      },
      // Ordered for stable client rendering (Sun→Sat, earliest interval first).
      openingHours: {
        select: { dayOfWeek: true, openMinute: true, closeMinute: true },
        orderBy: [{ dayOfWeek: "asc" }, { openMinute: "asc" }],
      },
    },
  });
  if (!row) return null;

  const [coords] = await db
    .selectFrom("app.addresses as a")
    .select(() => [
      sql<number>`ST_Y((a.location)::geometry)`.as("lat"),
      sql<number>`ST_X((a.location)::geometry)`.as("lon"),
    ])
    .where("a.id", "=", row.address.id)
    .execute();
  // Degrade (don't throw) when the address has no readable coordinates → 404.
  if (!coords || coords.lat == null || coords.lon == null) return null;

  return {
    uid: row.uid,
    name: row.name,
    // Never DELETED — the where filter above excludes it; cast, don't re-check.
    status: row.status as "ACTIVE" | "BANNED",
    banner: row.banner,
    type: { slug: row.type.slug },
    address: {
      country: row.address.country,
      city: row.address.city,
      region: row.address.region,
      zip: row.address.zip,
      street: row.address.street,
      location: { lat: coords.lat, lon: coords.lon },
    },
    photos: row.photos,
    instagramTag: row.instagramTag,
    // The full matchable set (name + tags + @handle) — what a story must show.
    tags: getBusinessShareTags({
      name: row.name,
      tags: row.tags,
      instagramTag: row.instagramTag,
    }),
    description: row.description,
    websiteLink: row.websiteLink
      ? { url: row.websiteLink.url, status: row.websiteLink.status }
      : null,
    reservationLink: row.reservationLink
      ? { url: row.reservationLink.url, status: row.reservationLink.status }
      : null,
    menuLink: row.menuLink
      ? { url: row.menuLink.url, status: row.menuLink.status }
      : null,
    phoneNumber: row.phoneNumber,
    contactEmail: row.contactEmail,
    timezone: row.address.timezone,
    openingHours: row.openingHours,
  };
}
