import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/clients/aws/s3.js";
import { envVariables } from "../../environment/envVariables.js";
import { bucketPrefix } from "./bucketPrefix.js";

/**
 * Wipe the current stage's entire S3 folder (e.g. everything under
 * `development/`) so re-running the account seed starts from a clean slate and
 * uploaded seed media never stacks up across runs. Called from the seed's
 * cleanup step, mirroring the DB wipe.
 *
 * SAFETY: refuses to run unless `bucketPrefix` is a non-empty stage folder — an
 * empty prefix (production) would target the whole bucket. The account seed
 * itself also already refuses to run outside development/staging.
 */
export async function clearSeedS3Folder(): Promise<void> {
  if (!bucketPrefix) {
    console.log(
      "  → Skipping S3 cleanup (no stage prefix — refusing to wipe bucket root)",
    );
    return;
  }

  const Bucket = envVariables.S3_BUCKET;
  let ContinuationToken: string | undefined;
  let deleted = 0;

  // Page through the prefix. Each ListObjectsV2 page returns ≤1000 keys, and
  // DeleteObjects accepts ≤1000 per call, so one delete per page is always safe.
  do {
    const listed = await s3Client.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: bucketPrefix,
        ContinuationToken,
      }),
    );

    const objects = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k))
      .map((Key) => ({ Key }));

    if (objects.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      deleted += objects.length;
    }

    ContinuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (ContinuationToken);

  if (deleted > 0) {
    console.log(`  → Deleted ${deleted} S3 objects under ${bucketPrefix}`);
  }
}
