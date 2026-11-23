import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../clients/aws/s3.js";
import { envVariables } from "../../../../environment/envVariables.js";

export const head = async (key: string) => {
  const meta = await s3Client.send(
    new HeadObjectCommand({ Bucket: envVariables.S3_BUCKET, Key: key })
  );
  return meta;
};
