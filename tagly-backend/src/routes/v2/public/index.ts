import { Router } from "express";
import {
  appIpLimiter,
  authIpLimiter,
} from "../../../middleware/security/rateLimit.js";
import { validateReq } from "../../../middleware/request/validateRequest.js";
import {
  SuggestLocaleBodySchema,
  ResolveQrStickerParamsSchema,
} from "@tagly/models/v2/crossApp";
import { suggestLocale } from "../../../controllers/v2/public/suggestLocale.js";
import { resolveQrSticker } from "../../../controllers/v2/public/resolveQrSticker.js";
import { getPublicStats } from "../../../controllers/v2/public/getPublicStats.js";
import authRouter from "./auth/index.js";

/**
 * `/v2/public` — unauthenticated v2 surface. Each route/subgroup declares its
 * own limiter so the security posture is legible from the path:
 *
 *   - `/suggest-locale` → `appIpLimiter` (general public IP limit)
 *   - `/auth/**`        → `authIpLimiter` (stricter, for OTP/OAuth abuse)
 */
const r = Router();

// Pre-onboarding locale helper (called before signup vs. login is chosen).
r.post(
  "/suggest-locale",
  appIpLimiter,
  validateReq("body", SuggestLocaleBodySchema),
  suggestLocale,
);

// QR sticker → business resolution (tagly-join landing personalization).
r.get(
  "/stickers/:id",
  appIpLimiter,
  validateReq("params", ResolveQrStickerParamsSchema),
  resolveQrSticker,
);

// Public marketing counters (tagly-join social proof; the join page caches it).
r.get("/stats", appIpLimiter, getPublicStats);

// Auth (OTP + Google/Apple) — stricter IP limit across the whole subtree.
r.use("/auth", authIpLimiter, authRouter);

export default r;
