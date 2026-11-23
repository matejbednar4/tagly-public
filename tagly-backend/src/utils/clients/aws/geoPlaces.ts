import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { envVariables } from "../../../environment/envVariables.js";

// Amazon Location Service — Places API (forward geocoding). Auth is IAM via the
// default credential provider chain: the App Runner instance role / ECS task role
// in staging+prod, local AWS creds in dev (same as s3Client/rekognitionClient).
// The SDK's default retry (standard mode, 3 attempts) backs off on
// ThrottlingException, which is why we no longer need a rate-limit gate.
//
// Timeouts (E061): the SDK default is NO timeout at all (DEFAULT_REQUEST_TIMEOUT
// = 0), so a hung Amazon Location call used to wait forever — worst case inside
// the sharePayment worker, where one hang wedged the whole settlement loop under
// its singleton lock. 8s hard cap per attempt restores origin/main's budget
// (the LocationIQ path aborted at 8s); `throwOnRequestTimeout` is required or
// the handler only WARNS on expiry. Worst case with the 3 standard-mode
// attempts: ~24s + backoff, bounded.
export const geoPlacesClient = new GeoPlacesClient({
  region: envVariables.AWS_REGION,
  requestHandler: {
    connectionTimeout: 3_000,
    requestTimeout: 8_000,
    throwOnRequestTimeout: true,
  },
});
