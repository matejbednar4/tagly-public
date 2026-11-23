import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/clients/aws/s3.js";
import { envVariables } from "../../environment/envVariables.js";

/**
 * Local source of every seed image. The `tagly-shared/client/assets/seed/` tree maps
 * 1:1 onto the S3 `public/seed/` prefix (e.g. `italian.jpg` →
 * `public/seed/italian.jpg`, `shares/matt/restaurant-1.png` →
 * `public/seed/shares/matt/restaurant-1.png`).
 *
 * Resolved from this file's location: dev_fake_data → seed → src → backend →
 * repo root, then into `tagly-shared/client/assets/seed`.
 */
const SEED_ASSETS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tagly-shared/client/assets/seed",
);

function contentTypeForKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Upload a local seed asset to S3 so the seeded Media/banner rows actually
 * render — the account seed is self-contained and needs no manual
 * `aws s3 sync`. Dev/staging only (the account seed already refuses to run in
 * production).
 *
 * @param sourceRelPath asset path relative to `tagly-shared/client/assets/seed/`
 *                      (e.g. `shares/matt/restaurant-1.png`)
 * @param destKey       the exact S3 key the Media row stores (bucket-prefixed,
 *                      e.g. `development/public/seed/s1/shares/matt/restaurant-1.png`)
 */
export async function uploadSeedAssetToS3(
  sourceRelPath: string,
  destKey: string,
): Promise<void> {
  const localPath = path.join(SEED_ASSETS_ROOT, sourceRelPath);
  const body = await fs.promises.readFile(localPath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: envVariables.S3_BUCKET,
      Key: destKey,
      Body: body,
      ContentType: contentTypeForKey(destKey),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}
