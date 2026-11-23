import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { s3Client } from "../../clients/aws/s3.js";
import { envVariables } from "../../../environment/envVariables.js";

export const presignUploadToS3 = ({
  key,
  contentType,
  maxBytes,
  meta = {},
  startsWithContentType,
  extraConditions = [],
  // 5 minutes — a create can carry a banner + BUSINESS_MAX_PHOTOS images at
  // ~4 MB each uploaded in parallel on a mobile uplink; 2 minutes was tight
  // enough that a slow connection could expire the batch mid-upload.
  expiresIn = 5 * 60,
}: {
  key: string;
  contentType: string; // e.g., "image/jpeg", "video/mp4"
  maxBytes: number; // server-enforced size limit
  meta?: Record<string, string | number | boolean>;
  startsWithContentType?: string; // e.g., "image/"
  extraConditions?: any[];
  expiresIn?: number;
}) => {
  const fields: Record<string, string> = {
    "Content-Type": contentType,
    success_action_status: "201", // so you get a 201 Created response on success
    // DO NOT set "acl" since ACLs are disabled (Bucket owner enforced)
  };

  for (const [k, v] of Object.entries(meta)) {
    fields[`x-amz-meta-${k}`] = String(v);
  }

  const conditions: any[] = [
    ["content-length-range", 1, maxBytes],
    // Key: exact match to your Key; or allow a prefix with ["starts-with", "$key", "uploads/"]
    ["eq", "$key", key],
  ];

  if (startsWithContentType) {
    conditions.push(["starts-with", "$Content-Type", startsWithContentType]);
  } else {
    conditions.push(["eq", "$Content-Type", contentType]);
  }

  for (const [k, v] of Object.entries(meta)) {
    conditions.push(["eq", `$x-amz-meta-${k}`, String(v)]);
  }

  if (extraConditions.length) {
    conditions.push(...extraConditions);
  }

  return createPresignedPost(s3Client, {
    Bucket: envVariables.S3_BUCKET,
    Key: key,
    Fields: fields,
    Conditions: conditions,
    Expires: expiresIn, // seconds
  });
};
