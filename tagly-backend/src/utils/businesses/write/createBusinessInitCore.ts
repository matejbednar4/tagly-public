import { sql } from "kysely";
import prisma from "../../../prisma/prisma.js";
import { db } from "../../../db/kysely.js";
import { resolveBusinessTypeBySlugOrThrow } from "./resolveBusinessTypeBySlugOrThrow.js";
import { assertBusinessTextsAllowedOrThrow } from "./assertBusinessTextsAllowedOrThrow.js";
import { geocodeBusinessAddressOrThrow } from "./geocodeBusinessAddressOrThrow.js";
import { assertBusinessCountryMatchesAdvertiserLocaleOrThrow } from "./assertBusinessCountryMatchesAdvertiserLocaleOrThrow.js";
import {
  createBusinessPendingMedia,
  presignBusinessPendingUpload,
} from "./media/createBusinessPendingUploads.js";
import type { BusinessWriteActor } from "./businessWriteActor.js";
import type {
  CreateBusinessInitBody,
  CreateBusinessInitResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * Phase 1 of creating a business page (local subaccount) — the shared
 * orchestration behind the advertiser endpoint (`POST /v2/advertisers/me/
 * businesses/init`) and its admin twin (`POST /v2/admin/businesses/init`).
 * The wire bodies are identical (the admin schema aliases the advertiser's),
 * so both controllers call this with their actor; see `businessWriteActor.ts`
 * for exactly what differs per actor.
 *
 * Flow:
 * 1. Resolve the type slug + geocode the address BEFORE any DB write.
 * 2. Advertiser actor only: enforce the advertiser-locale ↔ geocoded-country
 *    invariant (an advertiser can never own a business outside their own
 *    country). An admin creates UNOWNED pages, which may live in any country.
 * 3. Create PendingLocalSubaccount + PendingMedia slots (banner + photos),
 *    persisting the geocoder-normalized address (the geocoder is the single
 *    source of truth for the fields paired with its lat/lon). Admin-created
 *    pending rows have `advertiserId: null` — the origin/main safety guard
 *    that keeps the two surfaces' confirm claims disjoint.
 * 4. Write the PostGIS point + city centroid.
 * 5. Return short-lived presigned S3 POSTs — the client uploads immediately,
 *    then calls confirm.
 */
export async function createBusinessInitCore(
  actor: BusinessWriteActor,
  body: CreateBusinessInitBody,
): Promise<CreateBusinessInitResponse> {
  const { name, typeSlug, address, bannerMime, photoMimes = [] } = body;

  const validType = await resolveBusinessTypeBySlugOrThrow(typeSlug);

  // Customer-surfaced text must be clean (4951 on a hit).
  assertBusinessTextsAllowedOrThrow({ name });

  // --- Geocode BEFORE DB writes ---
  const geo = await geocodeBusinessAddressOrThrow(address);
  const { geocoded, lat, lon, cityLat, cityLon, timezone } = geo;

  if (actor.kind === "advertiser") {
    await assertBusinessCountryMatchesAdvertiserLocaleOrThrow({
      advertiserId: actor.advertiserId,
      countryCode: geocoded.countryCode,
    });
  }

  // --- Transaction: banner PM -> pending business -> photo PMs ---
  const result = await prisma.$transaction(async (tx) => {
    const bannerPM = await createBusinessPendingMedia(tx, {
      purpose: "LOCAL_BANNER",
      mime: String(bannerMime),
    });

    const pendingBusiness = await tx.pendingLocalSubaccount.create({
      data: {
        name: name.trim(),
        // Admin creates unowned ("subsidized-track") pages — no advertiser.
        advertiser:
          actor.kind === "advertiser"
            ? { connect: { id: actor.advertiserId } }
            : undefined,
        type: { connect: { id: validType.id } },
        status: "DRAFT",
        banner: { connect: { id: bannerPM.id } },
        // Persist the geocoder-normalized fields, not the user-supplied ones.
        address: {
          create: {
            country: geocoded.country,
            countryCode: geocoded.countryCode,
            region: geocoded.region,
            city: geocoded.city,
            zip: geocoded.zip,
            street: geocoded.street,
            timezone,
          },
        },
        tags: [], // search aliases ride the admin confirm body, never init
      },
      select: { id: true, addressId: true },
    });

    const photoPMs = await Promise.all(
      photoMimes.map((photoMime) =>
        createBusinessPendingMedia(tx, {
          purpose: "LOCAL_PHOTO",
          mime: String(photoMime),
          pendingLocalId: pendingBusiness.id,
        }),
      ),
    );

    return {
      pendingBusinessId: pendingBusiness.id,
      addressId: pendingBusiness.addressId,
      banner: bannerPM,
      photos: photoPMs,
    };
  });

  const { pendingBusinessId, addressId, banner, photos } = result;

  // PostGIS point + city centroid (outside the tx — pending record, safe).
  await sql`
    UPDATE app.addresses
    SET
      location = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
      city_location = ST_SetSRID(ST_MakePoint(${cityLon}, ${cityLat}), 4326)::geography
    WHERE id = ${addressId}
  `.execute(db);

  // --- Presign uploads (outside transaction) ---
  const meta = { "pending-local-id": String(pendingBusinessId) };
  const [bannerUpload, photoUploads] = await Promise.all([
    presignBusinessPendingUpload(banner, { meta, slot: "banner" }),
    Promise.all(
      photos.map((pm, i) =>
        presignBusinessPendingUpload(pm, { meta, slot: `p${i + 1}` }),
      ),
    ),
  ]);

  return {
    pendingBusinessId,
    uploads: {
      banner: bannerUpload,
      photos: photoUploads,
    },
  };
}
