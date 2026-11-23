import { Router } from "express";
import { verifyJwt } from "../../middleware/auth/verifyJwt.js";
import {
  requireCustomerCapability,
  requireAdvertiserCapability,
  requireAdminCapability,
} from "../../middleware/auth/requireCapability.js";
import {
  authedUserLimiter,
  gentlePerRouteLimiter,
} from "../../middleware/security/rateLimit.js";
import v2PublicRouter from "./public/index.js";
import v2CustomersRouter from "./customers/index.js";
import v2AdvertisersRouter from "./advertisers/index.js";
import v2AdminRouter from "./admin/index.js";
import v2CrossRouter from "./cross/index.js";

/**
 * v2 namespace root — mounted once at `/v2` in `app.ts`. The folder tree mirrors
 * the URL path one-segment-per-folder, so a route's security middleware is
 * legible from where it lives. Each group/segment declares its own middleware at
 * its mount (rather than a blanket limiter here):
 *
 *   - `public`      → per-route public limiters (`appIpLimiter` / `authIpLimiter`) (`/v2/public/…`)
 *   - `customers`   → `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireCustomerCapability`   (`/v2/customers/…`)
 *   - `advertisers` → `verifyJwt, authedUserLimiter, gentlePerRouteLimiter, requireAdvertiserCapability` (`/v2/advertisers/…`)
 *   - `cross`       → `verifyJwt, authedUserLimiter, gentlePerRouteLimiter`                              (`/v2/cross/…`)
 *
 * As each authed group lands, import its router and add one `r.use(...)` line
 * with the middleware tuple above. `public`, `customers`, and `advertisers` are
 * wired today.
 */
const r = Router();

r.use("/public", v2PublicRouter);

r.use(
  "/customers",
  verifyJwt,
  authedUserLimiter,
  gentlePerRouteLimiter,
  requireCustomerCapability,
  v2CustomersRouter,
);

r.use(
  "/advertisers",
  verifyJwt,
  authedUserLimiter,
  gentlePerRouteLimiter,
  requireAdvertiserCapability,
  v2AdvertisersRouter,
);

r.use(
  "/admin",
  verifyJwt,
  authedUserLimiter,
  gentlePerRouteLimiter,
  requireAdminCapability,
  v2AdminRouter,
);

// Cross-app: any valid JWT (no capability requirement) — both apps post here.
r.use(
  "/cross",
  verifyJwt,
  authedUserLimiter,
  gentlePerRouteLimiter,
  v2CrossRouter,
);

export default r;
