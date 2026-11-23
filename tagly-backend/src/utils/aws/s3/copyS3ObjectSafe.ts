import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { s3Client } from "../../clients/aws/s3.js";
import { envVariables } from "../../../environment/envVariables.js";

type CopyOpts = {
  srcKey: string;
  dstKey: string;
  contentType: string;
  metadata?: Record<string, string>;
  cacheControl?: string; // default below
  sse?: "AES256"; // default below
};

export async function copyS3ObjectSafe({
  srcKey,
  dstKey,
  contentType,
  metadata = {},
  cacheControl = "public, max-age=31536000, immutable",
  sse = "AES256",
}: CopyOpts) {
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: envVariables.S3_BUCKET,
      CopySource: `/${envVariables.S3_BUCKET}/${srcKey}`,
      Key: dstKey,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: cacheControl,
      ServerSideEncryption: sse,
      MetadataDirective: "REPLACE",
    })
  );

  // optional: verify exists
  await s3Client.send(
    new HeadObjectCommand({ Bucket: envVariables.S3_BUCKET, Key: dstKey })
  );
  return { key: dstKey };
}
