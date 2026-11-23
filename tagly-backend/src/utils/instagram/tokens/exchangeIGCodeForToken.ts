import { envVariables } from "../../../environment/envVariables.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";
import { IG_HTTP_TIMEOUT_MS } from "../../../constants/instagram/INSTAGRAM.js";

/**
 * Exchange an OAuth code for a short-lived IG token.
 * Throws 2003 on HTTP/network/timeout/shape errors.
 *
 * The `redirect_uri` sent here must be byte-identical to the one the client
 * authorized with (RFC 6749 §4.1.3 — Meta rejects the exchange otherwise). That
 * value is baked into the customer app bundle (`tagly-customer/app.config.ts`)
 * and mirrored by `envVariables.CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI` —
 * the two must move together.
 */
export const exchangeIGCodeForToken = async (code: string): Promise<string> => {
  if (!code) {
    throw createCustomError(2003, "Missing parameters for token exchange", 502);
  }

  const tokenResponseJson = await fetchJSONWithAbort(
    "https://api.instagram.com/oauth/access_token",
    IG_HTTP_TIMEOUT_MS,
    2003,
    "Failed to exchange code for token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: envVariables.IG_CLIENT_ID,
        client_secret: envVariables.IG_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: envVariables.CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI,
        code,
      }),
    },
  );

  const shortLivedToken = tokenResponseJson?.access_token;

  if (!shortLivedToken || typeof shortLivedToken !== "string") {
    throw createCustomError(2003, "Malformed token exchange response", 502);
  }

  return shortLivedToken;
};
