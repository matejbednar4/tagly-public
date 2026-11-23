import fs from "node:fs";

/**
 * The RDS CA bundle used by every SSL-enabled Postgres connection, read once
 * and cached.
 *
 * The cert is not emitted into `dist` — `build` is `rm -rf dist && tsc` with no
 * asset-copy step, so the only copy lives at the backend root (the Dockerfile
 * puts it at `/app/tagly-backend/global-bundle.pem`). `rootDir: src` and
 * `outDir: dist` mirror each other, so the relative path below resolves from
 * both `src/…` (tsx, local dev) and `dist/…` (node, deployed).
 *
 * Every reader goes through here instead of hand-rolling its own
 * `new URL("../../…")`: the path is depth-sensitive, and the three independent
 * copies silently drifted when this file's folder moved during the v1/v2
 * restructure — `advisoryLock` kept a depth-2 path after moving to depth 4, so
 * the cleanup and maintenance workers threw ENOENT on every tick.
 */
let cached: string | undefined;

export function readRdsCa(): string {
  if (cached !== undefined) return cached;

  const url = new URL("../../../../global-bundle.pem", import.meta.url);
  try {
    cached = fs.readFileSync(url, "utf8");
  } catch (cause) {
    throw new Error(
      `RDS CA bundle not found at ${url.pathname}. It is copied to the backend root by the Dockerfile; the path here is relative to utils/core/db/ and must be updated if this file moves.`,
      { cause },
    );
  }

  return cached;
}
