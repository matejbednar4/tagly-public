import type { RequestHandler } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { asyncHandler } from "../../utils/core/http/asyncHandler.js";
import { ERROR_CODES } from "@tagly/models/shared";
import { envVariables } from "../../environment/envVariables.js";

type AppClient = "customer" | "advertiser";

/**
 * Enforce a minimum app **version** (semver) for mobile clients.
 *
 * Reads `X-App-Version` (e.g. "2.1.0") — the app's marketing version, which is
 * identical on iOS and Android, so a single threshold per app gates both
 * platforms. Compares it against `MIN_CUSTOMER_VERSION` / `MIN_ADVERTISER_VERSION`;
 * below the minimum → HTTP 426 (Upgrade Required) with CLIENT_OUTDATED, which the
 * apps turn into the blocking UpdateRequiredScreen. Raising a minimum is how a
 * forced cutover (e.g. v2) is triggered.
 *
 * Pass-through (no gate) when: no `X-App-Client` header (dashboard, workers,
 * webhooks), an unknown client, `X-App-Platform: web` (advertiser web app), or a
 * missing/malformed `X-App-Version` (builds from before this header existed).
 *
 * Note: every shipped app that sends `X-App-Build` also sends `X-App-Version`
 * (both added in the same release), so switching from build to version gates the
 * same clients with no client change.
 */
export const enforceMinVersion: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const clientHeader = req.headers["x-app-client"];
    if (!clientHeader || typeof clientHeader !== "string") return next();

    const client = clientHeader.toLowerCase() as AppClient;
    if (client !== "customer" && client !== "advertiser") return next();

    // The advertiser web app is not version-gated.
    if (req.headers["x-app-platform"] === "web") return next();

    const versionHeader = req.headers["x-app-version"];
    if (!versionHeader || typeof versionHeader !== "string") return next();

    const appVersion = parseVersion(versionHeader);
    if (!appVersion) return next(); // malformed → let through (graceful)

    const minVersion = parseVersion(
      client === "customer"
        ? envVariables.MIN_CUSTOMER_VERSION
        : envVariables.MIN_ADVERTISER_VERSION,
    );
    // The env value is validated (and defaults to "0.0.0"), so this always parses;
    // guard anyway so a bad value never hard-blocks every client.
    if (!minVersion) return next();

    if (compareVersions(appVersion, minVersion) < 0) {
      // expected: the update gate working as intended (426) — not a bug, muted.
      throw createCustomError(
        ERROR_CODES.SERVER.CLIENT_OUTDATED,
        "App version is outdated. Please update to continue.",
        { status: 426 /* Upgrade Required */, expected: true },
      );
    }

    next();
  },
);

/**
 * Parse a dotted numeric version ("2.1.0") into its segments. Any pre-release /
 * build suffix (`-beta`, `+123`) is stripped first. Returns null if any segment
 * isn't a non-negative integer.
 */
function parseVersion(raw: string): number[] | null {
  const core = raw.trim().split(/[-+]/)[0];
  if (!core) return null;
  const parts = core.split(".").map(Number);
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return parts;
}

/** Numeric per-segment compare: <0 if a<b, >0 if a>b, 0 if equal. Missing segments count as 0 (so 2.1 == 2.1.0). */
function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
