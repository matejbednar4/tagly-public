import { envVariables } from "../../../environment/envVariables.js";
import { encryptIgToken } from "./igTokenEnc.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";
import { IG_HTTP_TIMEOUT_MS } from "../../../constants/instagram/INSTAGRAM.js";

/**
 * Get a long-lived IG token from a short-lived token.
 * Throws 2002 on HTTP/network/shape errors.
 */
export const getAndEncryptIgLongLivedToken = async (
  token: string,
): Promise<{ encryptedToken: string; expiresAt: Date }> => {
  if (!token || typeof token !== "string") {
    throw createCustomError(2002, "Invalid Instagram access token", 502);
  }

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", envVariables.IG_CLIENT_SECRET);
  url.searchParams.set("access_token", token);

  const responseJson = await fetchJSONWithAbort(
    url.toString(),
    IG_HTTP_TIMEOUT_MS,
    2002,
    "Failed to get long-lived token from Instagram",
  );
  const accessToken = responseJson?.access_token;
  const LLTexpiresIn = responseJson?.expires_in;

  if (!accessToken || typeof LLTexpiresIn !== "number") {
    throw createCustomError(2002, "Malformed long-lived token response", 502);
  }

  const encLLT = encryptIgToken(accessToken);

  const LLTexpiresAt = new Date(Date.now() + LLTexpiresIn * 1000);

  return {
    encryptedToken: encLLT,
    expiresAt: LLTexpiresAt,
  };
};
