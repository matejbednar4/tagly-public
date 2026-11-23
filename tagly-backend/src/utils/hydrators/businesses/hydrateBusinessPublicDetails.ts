import prisma from "../../../prisma/prisma.js";
import { businessVisibleWhere } from "../../businesses/businessAccessibility.js";
import type { BusinessPublicDetails } from "@tagly/models/v2/customerApp";
import { getBusinessShareTags } from "../../businesses/getBusinessShareTags.js";
import hydrateBusinessPublicPreviews from "./hydrateBusinessPublicPreviews.js";

/**
 * Hydrates one business into `BusinessPublicDetails` for the customer detail page:
 * the standard `BusinessPublicPreview` (identity + reward estimate, via the shared
 * preview hydrator) plus the gallery photos, the detail-page content fields
 * (description / website / reservation / menu / phone), the business timezone, and
 * its opening-hours periods. Returns null when the business can't be resolved
 * (e.g. unreadable address coords) so the controller can 404.
 *
 * Per the hydrator rules: stored fields are read as-is, never re-validated.
 * `timezone` is NOT NULL on the address so it's always present; the content fields
 * are nullable and pass through directly.
 */
export default async function hydrateBusinessPublicDetails(opts: {
  businessId: number;
  customerId: number;
}): Promise<BusinessPublicDetails | null> {
  const [preview] = await hydrateBusinessPublicPreviews({
    businessIds: [opts.businessId],
    customerId: opts.customerId,
  });
  if (!preview) return null;

  // Defense-in-depth: the customer-visibility gate is enforced HERE as well as
  // in the controllers — a caller that forgets the filter gets null (404), so a
  // DELETED/BANNED page can never hydrate for a customer.
  const row = await prisma.localSubaccount.findFirst({
    where: { id: opts.businessId, ...businessVisibleWhere },
    select: {
      instagramTag: true,
      tags: true,
      description: true,
      // Web links go through the admin-reviewed `Link` model — only APPROVED
      // links are surfaced (see `approvedUrl`).
      websiteLink: { select: { url: true, status: true } },
      reservationLink: { select: { url: true, status: true } },
      menuLink: { select: { url: true, status: true } },
      phoneNumber: true,
      contactEmail: true,
      // country/region/zip complete the full address (city/street/location come
      // from the preview); timezone drives client-side "open now".
      address: {
        select: {
          country: true,
          region: true,
          zip: true,
          timezone: true,
        },
      },
      // ALL gallery photos — the write boundary caps them at BUSINESS_MAX_PHOTOS
      // (8, error 5206), so no `take` here (a stray `take: 3` used to truncate
      // the customer gallery; the owner hydrator never had one).
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

  if (!row) return null; // business disappeared since preview hydrate → 404

  return {
    ...preview,
    // Override the preview's city/street/location address with the full shape.
    address: {
      ...preview.address,
      country: row.address.country,
      region: row.address.region,
      zip: row.address.zip,
    },
    photos: row.photos,
    instagramTag: row.instagramTag,
    // The full matchable set (name + tags + @handle) — what the story must show.
    tags: getBusinessShareTags({
      name: preview.name,
      tags: row.tags,
      instagramTag: row.instagramTag,
    }),
    description: row.description,
    websiteUrl: approvedUrl(row.websiteLink),
    reservationUrl: approvedUrl(row.reservationLink),
    menuUrl: approvedUrl(row.menuLink),
    phoneNumber: row.phoneNumber,
    contactEmail: row.contactEmail,
    timezone: row.address.timezone,
    openingHours: row.openingHours,
  };
}

/** A link's URL only when it's been admin-APPROVED; otherwise null (hidden). */
function approvedUrl(
  link: { url: string; status: string } | null,
): string | null {
  return link && link.status === "APPROVED" ? link.url : null;
}
