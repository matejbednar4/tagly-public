import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchWithTimeout } from "../../core/http/fetchWithTimeout.js";
import { IG_HTTP_TIMEOUT_MS } from "../../../constants/instagram/INSTAGRAM.js";

/**
 * Verifies that the user has granted instagram_manage_insights permission.
 *
 * Makes a test call to the IG insights endpoint. If the call fails with a
 * permission-related error, throws 4099. Other failures throw 4006.
 *
 * @throws {CustomError} 4007 - Missing token or IG user id
 * @throws {CustomError} 4008 - Failed to call IG insights
 * @throws {CustomError} 4099 - Missing instagram_manage_insights permission
 * @throws {CustomError} 4006 - Failed to verify permission (upstream error)
 */
export async function checkUserInstagramPermission(
  userAccessToken: string,
  igUserId: string
) {
  if (!userAccessToken || !igUserId) {
    throw createCustomError(4007, "Missing token or IG user id", 502);
  }

  const url = new URL(`https://graph.instagram.com/${igUserId}/insights`);
  url.searchParams.set("metric", "reach");
  url.searchParams.set("period", "day");
  url.searchParams.set("access_token", userAccessToken);

  // Raw Response (not fetchJSONWithAbort): a non-ok status here is classified
  // below into 4099 (missing permission) vs 4006 (real error), so we need the
  // status + body, not a thrown CustomError. A hung IG call aborts at 15s and
  // surfaces as 4008 via the catch.
  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), IG_HTTP_TIMEOUT_MS, { method: "GET" });
  } catch (err) {
    throw createCustomError(4008, "Failed to call IG insights", 502);
  }

  if (response.ok) return;

  // Try to understand if this is a "missing permission" or a real error.
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // ignore
  }

  const error = json?.error;
  const message = (error?.message ?? "").toString();

  // Meta typically uses code 10 / 200 + permission messages for this kind of thing.
  const looksLikePermissionError =
    response.status === 400 ||
    response.status === 403 ||
    message.toLowerCase().includes("permission") ||
    message.toLowerCase().includes("manage_insights");

  if (looksLikePermissionError) {
    throw createCustomError(
      4099,
      "Missing instagram_manage_insights permission",
      403
    );
  }

  // Anything else is a real upstream problem.
  throw createCustomError(
    4006,
    "Failed to verify instagram_manage_insights permission",
    502
  );
}
