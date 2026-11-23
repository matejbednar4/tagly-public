import { Router } from "express";
import customersRouter from "./customers/index.js";
import advertisersRouter from "./advertisers/index.js";
import adminRouter from "./admin/index.js";

/**
 * `/v2/public/auth` — unauthenticated auth surface. The parent `/public` group
 * mounts this with `authIpLimiter` (stricter than the general IP limit), so
 * everything here is auth-rate-limited. Split by account kind:
 *
 *   - `/customers` → customer onboarding/login
 *   - `/advertisers` → advertiser onboarding/login
 *   - `/admin` → admin login (email + password + long emailed code)
 */
const r = Router();

r.use("/customers", customersRouter);
r.use("/advertisers", advertisersRouter);
r.use("/admin", adminRouter);

export default r;
