import { S3Client } from "@aws-sdk/client-s3";
import { envVariables } from "../../../environment/envVariables.js";

// Timeouts (E061 follow-up): the SDK default is NO timeout at all, so a hung
// S3 call blocked its caller forever (request paths + the cleanup worker's
// singleton tick). Deliberately IDLE-based (`socketTimeout`) rather than a
// hard `requestTimeout`: `uploadRemoteMediaToS3` streams IG originals with no
// byte cap by design, so a wall-clock cap would kill legitimate large
// multipart uploads — an idle timeout only kills sockets that stopped moving.
export const s3Client = new S3Client({
  region: envVariables.AWS_REGION,
  requestHandler: {
    connectionTimeout: 3_000,
    socketTimeout: 30_000,
  },
});
