import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";
import { IG_HTTP_TIMEOUT_MS } from "../../../constants/instagram/INSTAGRAM.js";

/**
 * Exchanges a still-valid long-lived Instagram token for a fresh one via the
 * Graph `refresh_access_token` endpoint. Returns the new token + its lifetime
 * (seconds). Throws on bad input / malformed upstream response.
 */
export async function refreshIgLongLivedTokenOrThrow(opts: {
  accessToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  if (!opts.accessToken || typeof opts.accessToken !== "string") {
    throw createCustomError(5101, "Invalid Instagram access token", 400);
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", opts.accessToken);

  const json = await fetchJSONWithAbort(
    url.toString(),
    IG_HTTP_TIMEOUT_MS,
    5102,
    "Failed to refresh Instagram access token"
  );

  const accessToken = json?.access_token;
  const expiresIn = json?.expires_in;

  if (typeof accessToken !== "string" || typeof expiresIn !== "number") {
    throw createCustomError(5103, "Malformed refresh token response", 502);
  }

  return { accessToken, expiresIn };
}
