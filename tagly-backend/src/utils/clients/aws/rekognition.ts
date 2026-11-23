import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { envVariables } from "../../../environment/envVariables.js"; // adjust path if needed

// Timeouts (E061 follow-up): the SDK default is NO timeout at all, so a hung
// Rekognition call blocked its caller forever (image moderation sits in the
// business create/edit + share create request paths). Sync image analysis on
// a ≤4 MB image is bounded work — 30s hard cap per attempt is generous;
// `throwOnRequestTimeout` is required or the handler only WARNS on expiry.
export const rekognitionClient = new RekognitionClient({
  region: envVariables.AWS_REGION,
  requestHandler: {
    connectionTimeout: 3_000,
    requestTimeout: 30_000,
    throwOnRequestTimeout: true,
  },
});
