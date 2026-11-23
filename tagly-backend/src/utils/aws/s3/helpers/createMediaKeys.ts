/**
 * S3 object-key builders for every media kind (local banners/media, share
 * media/thumbnails, and temporary Rekognition match-check uploads).
 *
 * Each builder prefixes the key with the environment segment
 * (`development/` / `staging/` / none for production) and a visibility segment
 * (`public/` vs `pending/`) so keys are namespaced per stage and lifecycle.
 */
import { envVariables } from "../../../../environment/envVariables.js";

type KeyParams = {
  mediaUid: string;
  ext: string;
  stage: "PUBLIC" | "PENDING";
};

/** Helper to add environment + public prefix automatically */
function basePrefix(stage?: "PUBLIC" | "PENDING") {
  let envPrefix = "";
  if (envVariables.APP_STAGE === "development") envPrefix = "development/";
  if (envVariables.APP_STAGE === "staging") envPrefix = "staging/";

  const vis = stage === "PUBLIC" ? "public/" : "pending/";
  return `${envPrefix}${vis}`;
}

/* ---------- Locals ---------- */
export function createLocalBannerKey({ mediaUid, ext, stage }: KeyParams) {
  return `${basePrefix(stage)}local-banners/${mediaUid}.${ext}`;
}

export function createLocalMediaKey({ mediaUid, ext, stage }: KeyParams) {
  return `${basePrefix(stage)}local-media/${mediaUid}.${ext}`;
}

/* ---------- Shares ---------- */
export function createShareMediaKey({ mediaUid, ext, stage }: KeyParams) {
  return `${basePrefix(stage)}shares/media/${mediaUid}.${ext}`;
}

export function createShareThumbnailKey({ mediaUid, ext, stage }: KeyParams) {
  return `${basePrefix(stage)}shares/thumbnails/${mediaUid}.${ext}`;
}

/* ---------- Match check (temp, deleted after Rekognition) ---------- */
export function createMatchCheckKey({
  mediaUid,
  ext,
}: {
  mediaUid: string;
  ext: string;
}) {
  return `${basePrefix("PENDING")}match-check/${mediaUid}.${ext}`;
}
