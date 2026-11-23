import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import {
  createBusinessPendingMedia,
  presignBusinessPendingUpload,
} from "./media/createBusinessPendingUploads.js";
import {
  businessNotFoundError,
  businessWriteScopeWhere,
  type BusinessWriteActor,
} from "./businessWriteActor.js";
import { BUSINESS_MAX_PHOTOS } from "@tagly/models/v2/crossApp";
import type {
  UpdateBusinessMediaInitBody,
  UpdateBusinessMediaInitResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * Phase 1 of editing a business page's banner/photos — the shared
 * orchestration behind the advertiser endpoint (`POST /v2/advertisers/me/
 * businesses/:uid/media/init`) and its admin twin (`POST /v2/admin/businesses/
 * :uid/media/init`). Keep-by-uid semantics: the client declares the
 * replacement banner and/or new photos it will upload plus which existing
 * photos it keeps, and gets presigned S3 POSTs back (short expiry — upload
 * immediately, then confirm). Actor differences are only the lookup scope +
 * not-found code (`businessWriteActor.ts`).
 *
 * The PendingMedia rows created here are FREE-FLOATING (`pendingLocalId:
 * null` — that's how confirm distinguishes update uploads from a create
 * flow's). Abandoned rows (upload never confirmed) are reaped by the
 * `stalePendingMedia` cleanup rule after 24h, S3 objects included.
 *
 * `keepPhotoUids` here is only a capacity pre-check (kept + new ≤ max) so the
 * client fails fast before uploading; confirm re-validates its own copy
 * authoritatively. Pure removals (nothing new to upload) skip init entirely.
 */
export async function updateBusinessMediaInitCore(
  actor: BusinessWriteActor,
  uid: string,
  body: UpdateBusinessMediaInitBody,
): Promise<UpdateBusinessMediaInitResponse> {
  const { newBannerMime, newPhotoMimes = [], keepPhotoUids = [] } = body;

  const local = await prisma.localSubaccount.findFirst({
    where: businessWriteScopeWhere(actor, uid),
    select: { id: true, photos: { select: { uid: true } } },
  });
  if (!local) throw businessNotFoundError(actor);

  const existingPhotoUids = new Set(local.photos.map((p) => p.uid));
  for (const keepUid of keepPhotoUids) {
    if (!existingPhotoUids.has(keepUid)) {
      throw createCustomError(5203, `Unknown photo uid: ${keepUid}`, 400);
    }
  }
  if (keepPhotoUids.length + newPhotoMimes.length > BUSINESS_MAX_PHOTOS) {
    throw createCustomError(
      5206,
      `A business can have at most ${BUSINESS_MAX_PHOTOS} photos`,
      400,
    );
  }

  // Free-floating pending rows (no pendingLocalId) — plain client, no tx
  // needed: each row is independent and abandoned ones get reaped.
  const bannerPM = newBannerMime
    ? await createBusinessPendingMedia(prisma, {
        purpose: "LOCAL_BANNER",
        mime: String(newBannerMime),
      })
    : null;
  const photoPMs = await Promise.all(
    newPhotoMimes.map((mime) =>
      createBusinessPendingMedia(prisma, {
        purpose: "LOCAL_PHOTO",
        mime: String(mime),
      }),
    ),
  );

  const meta = { "local-uid": uid };
  const [bannerUpload, photoUploads] = await Promise.all([
    bannerPM
      ? presignBusinessPendingUpload(bannerPM, { meta, slot: "banner" })
      : Promise.resolve(undefined),
    Promise.all(
      photoPMs.map((pm, i) =>
        presignBusinessPendingUpload(pm, { meta, slot: `p${i + 1}` }),
      ),
    ),
  ]);

  return {
    uploads: {
      banner: bannerUpload,
      photos: photoUploads,
    },
  };
}
