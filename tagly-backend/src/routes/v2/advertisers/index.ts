import { Router } from "express";
import meRouter from "./me/index.js";
import sharesRouter from "./shares/index.js";
import transactionsRouter from "./transactions/index.js";

/**
 * `/v2/advertisers/**` — authed advertiser group. Mounted in
 * `routes/v2/index.ts` behind `verifyJwt, authedUserLimiter,
 * gentlePerRouteLimiter, requireAdvertiserCapability`, so every handler can
 * rely on `req.user` being an advertiser.
 *
 * The tree mirrors the URL one-segment-per-folder: the current advertiser's own
 * profile + billing resources live under `/me`. Business pages, shares, etc.
 * land here as siblings when their v2 slices are built.
 */
const r = Router();

r.use("/me", meRouter);
r.use("/shares", sharesRouter);
r.use("/transactions", transactionsRouter);

export default r;
