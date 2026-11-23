import { sql } from "kysely";
import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { db } from "../../../db/kysely.js";
import { bumpBusinessRewardEstGen } from "../../pricing/rewardEstCache.js";
import { resolveBusinessTypeBySlugOrThrow } from "./resolveBusinessTypeBySlugOrThrow.js";
import { assertBusinessTextsAllowedOrThrow } from "./assertBusinessTextsAllowedOrThrow.js";
import { geocodeBusinessAddressOrThrow } from "./geocodeBusinessAddressOrThrow.js";
import { assertBusinessCountryMatchesAdvertiserLocaleOrThrow } from "./assertBusinessCountryMatchesAdvertiserLocaleOrThrow.js";
import { normalizeInstagramTag } from "./normalizeInstagramTag.js";
import { resolveBusinessLinkChanges } from "./resolveBusinessLinkChanges.js";
import { replaceOpeningHours } from "./replaceOpeningHours.js";
import {
  businessNotFoundError,
  businessWriteScopeWhere,
  type BusinessWriteActor,
} from "./businessWriteActor.js";
import type { UpdateBusinessBody } from "@tagly/models/v2/advertiserApp";

/**
 * Edit a business page — the shared orchestration behind the advertiser
 * endpoint (`PATCH /v2/advertisers/me/businesses/:uid`) and its admin twin
 * (`PATCH /v2/admin/businesses/:uid`). Runs the exact same domain pipeline as
 * create (the shared helpers in this folder): profanity checks on text
 * fields, strict re-geocode when the address is in the body, and link changes
 * through the admin-reviewed `Link` registry (a URL entered on edit is
 * screened by Safe Browsing and created PENDING, exactly like on create).
 * Returns the edited `localId`; each controller hydrates its own DTO.
 *
 * Actor differences (see `businessWriteActor.ts`):
 * - Lookup scope — advertiser: own + ACTIVE only (the 404 deliberately
 *   doesn't reveal BANNED); admin: any non-DELETED page, owned or unowned.
 * - Locale ↔ country invariant on an address change — advertiser: always
 *   (against their own locale); admin: only when the page HAS an advertiser
 *   (an unowned/subsidized page may move between countries freely — the
 *   long-standing semantics; the invariant is re-enforced if an advertiser is
 *   ever assigned).
 * - `tags` (search aliases) — admin wire only.
 *
 * Field semantics: omitted = unchanged, `null` = clear (clearable fields
 * only), `openingHours` present = replace-all.
 *
 * Writes:
 * - Address changes update the existing `Address` row via ONE Kysely UPDATE
 *   (geocoder-normalized text + timezone + PostGIS point + city centroid in a
 *   single atomic statement, so the row can never hold text from one address
 *   and the point of another). The business-row tx follows; a failure between
 *   the two leaves both rows internally consistent, and a client retry
 *   re-geocodes idempotently.
 * - Everything else lands in one Prisma tx (scalars, type, links, hours).
 * - A `typeSlug`/`address` change bumps the business reward-estimate
 *   generation (relocation/type moves the estimate for every customer);
 *   best-effort, cache fails open.
 *
 * Concurrency note: this flow and the media init/confirm flow write disjoint
 * columns (scalars/links/hours vs banner/photos), so an interleaved PATCH and
 * media confirm can't lose each other's fields.
 */
export async function updateBusinessCore(
  actor: BusinessWriteActor,
  uid: string,
  body: UpdateBusinessBody & {
    /** Search aliases — admin wire only; the advertiser schema has no tags. */
    tags?: string[];
  },
): Promise<{ localId: number }> {
  const {
    name,
    typeSlug,
    address,
    description,
    instagramTag,
    websiteUrl,
    reservationUrl,
    menuUrl,
    phoneNumber,
    contactEmail,
    openingHours,
    tags,
  } = body;

  const local = await prisma.localSubaccount.findFirst({
    where: businessWriteScopeWhere(actor, uid),
    select: {
      id: true,
      addressId: true,
      advertiserId: true,
      websiteLink: { select: { id: true, url: true } },
      reservationLink: { select: { id: true, url: true } },
      menuLink: { select: { id: true, url: true } },
    },
  });
  if (!local) throw businessNotFoundError(actor);

  // Customer-surfaced text must be clean (4951 on a hit) — same gate as create.
  assertBusinessTextsAllowedOrThrow({
    name,
    description,
    instagramTag,
    contactEmail,
  });

  const validType =
    typeSlug !== undefined
      ? await resolveBusinessTypeBySlugOrThrow(typeSlug)
      : null;

  // Re-geocode only when the address rides the body; the geocoder-normalized
  // fields (not the user's typing) are what gets persisted, same as create.
  const geo =
    address !== undefined ? await geocodeBusinessAddressOrThrow(address) : null;
  if (geo) {
    // The invariant holds against whoever OWNS the page: the advertiser actor
    // is the owner; for admin it's the page's advertiser, if any.
    const ownerAdvertiserId =
      actor.kind === "advertiser" ? actor.advertiserId : local.advertiserId;
    if (ownerAdvertiserId !== null) {
      await assertBusinessCountryMatchesAdvertiserLocaleOrThrow({
        advertiserId: ownerAdvertiserId,
        countryCode: geo.geocoded.countryCode,
      });
    }
  }

  // Resolve link changes through the shared registry BEFORE the tx (network
  // call to Safe Browsing). Unchanged URLs keep their row + moderation status.
  const links = await resolveBusinessLinkChanges({
    desired: { websiteUrl, reservationUrl, menuUrl },
    current: {
      websiteLink: local.websiteLink,
      reservationLink: local.reservationLink,
      menuLink: local.menuLink,
    },
  });

  // --- Address row: one atomic Kysely UPDATE (text + point together) ---
  if (geo) {
    const { geocoded, lat, lon, cityLat, cityLon, timezone } = geo;
    await db
      .updateTable("app.addresses")
      .set({
        country: geocoded.country,
        country_code: geocoded.countryCode,
        region: geocoded.region,
        city: geocoded.city,
        zip: geocoded.zip,
        street: geocoded.street,
        timezone,
        location: sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`,
        city_location: sql`ST_SetSRID(ST_MakePoint(${cityLon}, ${cityLat}), 4326)::geography`,
        updated_at: sql`now()`,
      })
      .where("id", "=", local.addressId)
      .execute();
  }

  // --- Business row: everything else in one tx ---
  const data: Prisma.LocalSubaccountUpdateInput = {};
  if (name !== undefined) data.name = name.trim();
  if (validType) data.type = { connect: { id: validType.id } };
  if (description !== undefined) data.description = description;
  if (instagramTag !== undefined) {
    data.instagramTag = normalizeInstagramTag(instagramTag);
  }
  if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (tags !== undefined) data.tags = tags;
  if (links.websiteLinkId !== undefined) {
    data.websiteLink =
      links.websiteLinkId === null
        ? { disconnect: true }
        : { connect: { id: links.websiteLinkId } };
  }
  if (links.reservationLinkId !== undefined) {
    data.reservationLink =
      links.reservationLinkId === null
        ? { disconnect: true }
        : { connect: { id: links.reservationLinkId } };
  }
  if (links.menuLinkId !== undefined) {
    data.menuLink =
      links.menuLinkId === null
        ? { disconnect: true }
        : { connect: { id: links.menuLinkId } };
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.localSubaccount.update({ where: { id: local.id }, data });
    }
    if (openingHours !== undefined) {
      await replaceOpeningHours(tx, { localId: local.id, periods: openingHours });
    }
  });

  // Relocation/type change moves the reward estimate for every customer —
  // per-business generation bump (best-effort, cache fails open).
  if (validType || geo) {
    await bumpBusinessRewardEstGen(local.id).catch(() => {});
  }

  return { localId: local.id };
}
