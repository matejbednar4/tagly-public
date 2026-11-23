import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../clients/aws/s3.js";
import { envVariables } from "../../../environment/envVariables.js";

export async function deleteS3KeysOrThrow(keys: string[]) {
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: envVariables.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  );
}
