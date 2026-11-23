import { createCustomError } from "../errors/createCustomError.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

/**
 * Fetch JSON with a hard timeout, throwing a `CustomError` (carrying the
 * caller's `errorCode`) on any HTTP / network / timeout / parse failure.
 *
 * Generic HTTP infra — the caller supplies the error code + message, so this is
 * not tied to any one integration. For failures you need to classify (read the
 * status/body before deciding), use `fetchWithTimeout` directly.
 */
export async function fetchJSONWithAbort(
  url: string,
  timeoutMs: number,
  errorCode: number,
  errorMsg: string,
  init?: RequestInit
): Promise<any> {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, init);
    if (!res.ok) {
      throw createCustomError(errorCode, errorMsg, 502);
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw createCustomError(errorCode, "Request timed out", 502);
    }
    // Pass through if it's already a createCustomError (e.g. the !res.ok above).
    if (e?.code && e?.httpStatusCode) throw e;
    throw createCustomError(errorCode, errorMsg, 502);
  }
}
