import { envVariables } from "../../environment/envVariables.js";

/**
 * S3 key prefix for the current stage, shared by every seed file that reads or
 * writes seed objects (banner/share uploads + the S3 cleanup). Empty in
 * production — consumers that delete must refuse to run when it's empty so we
 * can never target the whole bucket.
 */
export const bucketPrefix =
  envVariables.APP_STAGE === "development"
    ? "development/"
    : envVariables.APP_STAGE === "staging"
      ? "staging/"
      : "";
