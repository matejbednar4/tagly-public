import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";
import { IG_HTTP_TIMEOUT_MS } from "../../../constants/instagram/INSTAGRAM.js";

/**
 * Fetch basic user data from the Instagram Graph API.
 * Throws 2001 on HTTP/network/shape errors.
 */
export const getUserDataFromIG = async (
  token: string
): Promise<{
  id: string;
  followers_count: number;
  // Optional/defensive: `follows_count` (accounts the user follows) is captured
  // for the audience snapshot, but it is NOT part of the strict shape check, so
  // it can never newly break the auth/connect callers that ignore it if IG omits
  // it for some account.
  follows_count?: number;
  name?: string;
  username: string;
  account_type: string;
  profile_picture_url?: string;
}> => {
  if (!token || typeof token !== "string") {
    throw createCustomError(2001, "Invalid Instagram access token", 502);
  }

  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set(
    "fields",
    "id,followers_count,follows_count,name,username,account_type,profile_picture_url"
  );
  url.searchParams.set("access_token", token);

  const userData = await fetchJSONWithAbort(
    url.toString(),
    IG_HTTP_TIMEOUT_MS,
    2001,
    "Failed to get user data from Instagram"
  );

  // Minimal shape validation
  if (
    !userData ||
    typeof userData.id !== "string" ||
    typeof userData.username !== "string" ||
    typeof userData.account_type !== "string" ||
    typeof userData.followers_count !== "number"
  ) {
    throw createCustomError(2001, "Malformed user data from Instagram", 502);
  }

  return userData;
};
