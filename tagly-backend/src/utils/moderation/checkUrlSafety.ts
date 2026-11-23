import { envVariables } from "../../environment/envVariables.js";
import { SAFE_BROWSING } from "../../constants/integrations/SAFE_BROWSING.js";

/**
 * `"unsafe"` — Google flagged it. `"safe"` — not flagged. `"unknown"` — we
 * couldn't determine (API down / error); callers treat this like `"safe"` for
 * the auto-reject filter, so a Safe Browsing outage never auto-rejects links —
 * admin review remains the backstop.
 */
export type UrlSafety = "safe" | "unsafe" | "unknown";

/**
 * Screen a URL against Google Safe Browsing (malware / phishing / unwanted
 * software). Used as a first-pass auto-reject filter for business-supplied links
 * before admin review — it only catches *malicious* URLs, not inappropriate or
 * wrong ones (that's the admin's job).
 */
export async function checkUrlSafety(url: string): Promise<UrlSafety> {
  const key = envVariables.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!key) return "unknown"; // key not provisioned → skip; admin still reviews

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SAFE_BROWSING.REQUEST_TIMEOUT_MS,
    );
    let res: Response;
    try {
      res = await fetch(`${SAFE_BROWSING.ENDPOINT}?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: {
            clientId: SAFE_BROWSING.CLIENT_ID,
            clientVersion: SAFE_BROWSING.CLIENT_VERSION,
          },
          threatInfo: {
            threatTypes: SAFE_BROWSING.THREAT_TYPES,
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return "unknown";
    const json = (await res.json().catch(() => null)) as {
      matches?: unknown[];
    } | null;
    if (!json) return "unknown";
    // A non-empty `matches` array means at least one threat was found.
    return Array.isArray(json.matches) && json.matches.length > 0
      ? "unsafe"
      : "safe";
  } catch {
    return "unknown";
  }
}
