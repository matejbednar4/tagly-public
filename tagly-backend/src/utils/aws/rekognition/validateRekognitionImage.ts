// Rekognition image moderation. The block vocabulary lives in
// constants/content/REKOGNITION.ts (invariant policy: what counts as a
// violation never differs between versions).
import { rekognitionClient } from "../../clients/aws/rekognition.js";
import { DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";
import { createCustomError } from "../../core/errors/createCustomError.js";
import {
  moderationBlockKey,
  REKOG_MIN_CONFIDENCE_DEFAULT,
} from "../../../constants/content/REKOGNITION.js";
import { envVariables } from "../../../environment/envVariables.js";

export async function validateRekognitionImage(
  s3Key: string,
  /** Client-facing slot label ("banner", "photos.2") for errors[].path. */
  pathLabel?: string,
) {
  const minConf = REKOG_MIN_CONFIDENCE_DEFAULT;

  const result = await rekognitionClient.send(
    new DetectModerationLabelsCommand({
      MinConfidence: minConf,
      Image: { S3Object: { Bucket: envVariables.S3_BUCKET, Name: s3Key } },
    })
  );

  // One vocabulary decides BOTH whether to block and which key the client shows
  // ("nudity", "drugs", …), so a label can never be blocked without an
  // explanation or explained without being blocked. Matching spans
  // ParentName + Name because v7 top-level labels carry an EMPTY ParentName —
  // reading the category from ParentName alone made top-level hits unmatchable
  // (A-NEW14). Do NOT reintroduce exact label-name matching.
  const hits = (result.ModerationLabels ?? [])
    .filter((lbl) => (lbl.Confidence ?? 0) >= minConf)
    .map((lbl) => ({ lbl, key: moderationBlockKey(lbl.ParentName, lbl.Name) }))
    .filter((h): h is { lbl: (typeof h)["lbl"]; key: string } => h.key !== null);

  if (hits.length > 0) {
    throw createCustomError(5210, "Image violates content policy", {
      status: 422,
      errors: [
        {
          path: pathLabel ?? s3Key,
          message: hits[0].key,
        },
      ],
    });
  }
}
