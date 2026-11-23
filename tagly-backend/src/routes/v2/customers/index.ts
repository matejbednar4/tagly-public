import { Router } from "express";
import meRouter from "./me/index.js";
import businessesRouter from "./businesses/index.js";
import sharesRouter from "./shares/index.js";
import transactionsRouter from "./transactions/index.js";

/**
 * `/v2/customers/**` — authed customer group. Mounted in `routes/v2/index.ts`
 * behind `verifyJwt, authedUserLimiter, gentlePerRouteLimiter,
 * requireCustomerCapability`, so every handler can rely on `req.user`.
 *
 * The tree mirrors the URL one-segment-per-folder: the current customer's own
 * profile resources live under `/me`; their shares under `/shares`; their money
 * history under `/transactions`; the public business map + search under
 * `/businesses`.
 */
const r = Router();

r.use("/me", meRouter);
r.use("/shares", sharesRouter);
r.use("/transactions", transactionsRouter);
r.use("/businesses", businessesRouter);

export default r;
