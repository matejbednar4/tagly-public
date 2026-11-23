/**
 * Build a public CDN URL from an S3 object key.
 *
 * Joins the configured `CDN_BASE_URL` to the key, trimming any trailing
 * slashes from the base and leading slashes from the key so the result is a
 * single well-formed URL regardless of how either side is configured.
 */
import { envVariables } from "../../../../environment/envVariables.js";

export const cdnUrlFromKey = (key: string) => {
  return `${envVariables.CDN_BASE_URL.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
};
