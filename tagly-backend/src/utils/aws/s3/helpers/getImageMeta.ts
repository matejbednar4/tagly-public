/**
 * Fetch an image object from S3 and read its metadata via sharp.
 *
 * Downloads the object at `key` into a Buffer and runs `sharp().metadata()`
 * over it, returning the sharp `info` (width/height/format/etc.), the raw
 * `buf`, and the object's `contentType`. Used by callers that need image
 * dimensions for an already-uploaded object.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../clients/aws/s3.js";
import sharp from "sharp";
import { envVariables } from "../../../../environment/envVariables.js";

export const getImageMeta = async (key: string) => {
  const obj = await s3Client.send(
    new GetObjectCommand({ Bucket: envVariables.S3_BUCKET, Key: key })
  );
  const buf = Buffer.from(await obj.Body!.transformToByteArray());
  const info = await sharp(buf).metadata();
  return { info, buf, contentType: obj.ContentType ?? undefined };
};
