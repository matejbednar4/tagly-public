import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { generateUid } from "../../core/uids/generateUid.js";
import {
  promoteOnePendingMedia,
  promotePendingMedia,
} from "../../aws/s3/promotePendingMedia.js";
import { deleteS3KeysOrThrow } from "../../aws/s3/deleteS3KeysOrThrow.js";
import { assertBusinessTextsAllowedOrThrow } from "./assertBusinessTextsAllowedOrThrow.js";
import { assertBusinessCountryMatchesAdvertiserLocaleOrThrow } from "./assertBusinessCountryMatchesAdvertiserLocaleOrThrow.js";
import { normalizeInstagramTag } from "./normalizeInstagramTag.js";
import { resolveBusinessLinkChanges } from "./resolveBusinessLinkChanges.js";
import { validateAndCopyBusinessImages } from "./media/validateAndCopyBusinessImages.js";
import {
  pendingBusinessOwnerId,
  type BusinessWriteActor,
} from "./businessWriteActor.js";
import type { CreateBusinessConfirmBody } from "@tagly/models/v2/advertiserApp";

/**
 * Phase 2 of creating a business page — the shared orchestration behind the
 * advertiser endpoint (`POST /v2/advertisers/me/businesses/confirm`) and its
 * admin twin (`POST /v2/admin/businesses/confirm`). The detail fields
 * (description, links, phone, contact email, opening hours, instagram tag)
 * are written in the same atomic commit that promotes the pending row — so a
 * created business is complete from its first moment. Returns the created
 * `localId`; each controller hydrates its own response DTO from it.
 *
 * Flow:
 * 1. Atomic claim (DRAFT|READY → PROCESSING) prevents double-confirms. The
 *    claim (and the refetch) is scoped to the actor's pending-owner id —
 *    `advertiserId` for an advertiser, `null` for admin — so an admin can
 *    never claim an advertiser's pending row, and vice versa (the origin/main
 *    safety guard, preserved).
 * 2. Advertiser actor only: re-assert the locale ↔ country invariant
 *    (defense-in-depth; init already enforced it). Admin pages are unowned —
 *    no invariant to hold.
 * 3. Resolve web links via the shared `Link` registry (pre-tx — Safe Browsing
 *    screens brand-new URLs, flagged → REJECTED, else created PENDING; shown
 *    to customers only once admin-APPROVED).
 * 4. Validate uploaded media from S3 (banner must be 16:9 ± AR_TOL; every
 *    image passes the Rekognition moderation scan inside the validator) and
 *    copy pending → public keys.
 * 5. Atomic DB commit: promote media, create the LocalSubaccount with the
 *    detail fields (links connected by id; opening hours as nested rows;
 *    `advertiserId: null` for admin creates; admin-only `tags`), delete the
 *    pending rows.
 * 6. Best-effort delete of pending S3 keys; on any failure, full cleanup of
 *    copied keys + pending rows.
 */
export async function createBusinessConfirmCore(
  actor: BusinessWriteActor,
  body: CreateBusinessConfirmBody & {
    /** Search aliases — admin wire only; the advertiser schema has no tags. */
    tags?: string[];
  },
): Promise<{ localId: number }> {
  const ownerId = pendingBusinessOwnerId(actor);
  const {
    pendingBusinessId,
    description,
    instagramTag,
    websiteUrl,
    reservationUrl,
    menuUrl,
    phoneNumber,
    contactEmail,
    openingHours = [],
    tags,
  } = body;

  // Customer-surfaced text must be clean (4951 on a hit) — checked before
  // the claim so a rejection leaves the pending row resumable.
  assertBusinessTextsAllowedOrThrow({
    description,
    instagramTag,
    contactEmail,
  });

  // Claim (DRAFT|READY) -> PROCESSING
  const claimed = await prisma.pendingLocalSubaccount.updateMany({
    where: {
      id: pendingBusinessId,
      advertiserId: ownerId,
      status: { in: ["DRAFT", "READY"] },
    },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) {
    throw createCustomError(4091, "Already processing or finalized", 409);
  }

  const pending = await prisma.pendingLocalSubaccount.findFirst({
    where: { id: pendingBusinessId, advertiserId: ownerId },
    include: {
      address: { select: { id: true, countryCode: true } },
      banner: true,
      photos: true,
      type: { select: { id: true } },
    },
  });
  if (!pending) {
    throw createCustomError(4040, "Pending business not found", 404);
  }
  if (!pending.banner) throw createCustomError(5203, "Missing banner", 422);

  // Defense-in-depth: re-verify the geocoded country still matches the
  // advertiser's locale (init already enforced it). Admin pages are unowned.
  if (actor.kind === "advertiser") {
    await assertBusinessCountryMatchesAdvertiserLocaleOrThrow({
      advertiserId: actor.advertiserId,
      countryCode: pending.address.countryCode,
    });
  }

  const bannerPending = pending.banner;
  const normalizedIgTag = normalizeInstagramTag(instagramTag);

  // Resolve web links through the shared registry BEFORE the tx (network
  // call to Safe Browsing). Registry rows are de-duplicated and admin-owned,
  // so a row resolved here that a failed tx never connects is harmless.
  const links = await resolveBusinessLinkChanges({
    desired: { websiteUrl, reservationUrl, menuUrl },
  });

  const pendingKeys: string[] = [];
  const copiedFinalKeys: string[] = [];

  try {
    const businessUid = generateUid("LOCAL_SUBACCOUNT");

    const { bannerCopy, photoCopies } = await validateAndCopyBusinessImages({
      banner: {
        key: bannerPending.key,
        expectedMime: bannerPending.expectedMime,
        expectedMaxBytes: bannerPending.expectedMaxBytes,
      },
      photos: pending.photos.map((p) => ({
        key: p.key,
        expectedMime: p.expectedMime,
        expectedMaxBytes: p.expectedMaxBytes,
      })),
      metaTag: { "local-uid": businessUid },
      collect: { pendingKeys, copiedKeys: copiedFinalKeys },
    });
    if (!bannerCopy) throw createCustomError(5203, "Missing banner", 422);

    // ---- ATOMIC DB COMMIT ----
    const created = await prisma.$transaction(async (tx) => {
      const bannerMediaId = await promoteOnePendingMedia(tx, bannerCopy);
      const photoMediaIds = await promotePendingMedia(tx, photoCopies);

      const business = await tx.localSubaccount.create({
        data: {
          uid: businessUid,
          name: pending.name,
          instagramTag: normalizedIgTag,
          // Checked (relation) form throughout — Prisma forbids mixing scalar
          // FKs with the link connects / openingHours createMany below. Admin
          // creates stay UNOWNED (no advertiser — the subsidized track).
          advertiser:
            actor.kind === "advertiser"
              ? { connect: { id: actor.advertiserId } }
              : undefined,
          type: { connect: { id: pending.typeId } },
          address: { connect: { id: pending.addressId } },
          banner: { connect: { id: bannerMediaId } },
          photos: photoMediaIds.length
            ? { connect: photoMediaIds.map((id) => ({ id })) }
            : undefined,
          status: "ACTIVE",
          tags: tags ?? pending.tags,

          // Detail fields from the confirm body (all optional).
          description: description ?? null,
          phoneNumber: phoneNumber ?? null,
          contactEmail: contactEmail ?? null,
          // Link ids resolved by the registry above (PENDING until an admin
          // approves; a REJECTED URL stays dead).
          websiteLink: links.websiteLinkId
            ? { connect: { id: links.websiteLinkId } }
            : undefined,
          reservationLink: links.reservationLinkId
            ? { connect: { id: links.reservationLinkId } }
            : undefined,
          menuLink: links.menuLinkId
            ? { connect: { id: links.menuLinkId } }
            : undefined,
          openingHours: openingHours.length
            ? {
                createMany: {
                  data: openingHours.map((p) => ({
                    dayOfWeek: p.dayOfWeek,
                    openMinute: p.openMinute,
                    closeMinute: p.closeMinute,
                  })),
                },
              }
            : undefined,
        },
        select: { id: true },
      });

      // ---- Delete pending rows (break the banner FK first) ----
      await tx.pendingLocalSubaccount.update({
        where: { id: pending.id },
        data: { bannerId: null },
      });
      await tx.pendingMedia.deleteMany({
        where: {
          OR: [{ pendingLocalId: pending.id }, { id: bannerPending.id }],
        },
      });
      await tx.pendingLocalSubaccount.delete({ where: { id: pending.id } });

      return business;
    });

    await deleteS3KeysOrThrow(pendingKeys).catch(() => {});

    return { localId: created.id };
  } catch (err) {
    // ---- FAILURE CLEANUP (best-effort) ----
    await deleteS3KeysOrThrow([...copiedFinalKeys, ...pendingKeys]).catch(
      () => {},
    );
    await prisma
      .$transaction(async (tx) => {
        await tx.pendingLocalSubaccount.updateMany({
          where: { id: pendingBusinessId },
          data: { bannerId: null },
        });
        await tx.pendingMedia.deleteMany({
          where: { pendingLocalId: pendingBusinessId },
        });
        await tx.pendingLocalSubaccount.deleteMany({
          where: { id: pendingBusinessId },
        });
        await tx.address.deleteMany({
          where: {
            pendingLocalSubaccount: { id: pendingBusinessId },
            id: pending.address.id,
          },
        });
      })
      .catch(() => {});

    throw err;
  }
}
