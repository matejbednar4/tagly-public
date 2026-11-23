import type { RequestHandler } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { getEntityFromUid } from "../../utils/core/uids/getEntityFromUid.js";
import { asyncHandler } from "../../utils/core/http/asyncHandler.js";
import { ERROR_CODES } from "@tagly/models/shared";

function requireCapability(
  allowed: Array<"ADVERTISER" | "CUSTOMER" | "ADMIN">,
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    // Missing auth context entirely → 401
    if (!req.user?.uid) {
      // expected: session-level auth failure — muted from the error tracker.
      throw createCustomError(
        ERROR_CODES.SERVER.AUTH.MISSING, // 200
        "Unauthorized",
        { status: 401, expected: true },
      );
    }

    const entity = getEntityFromUid(req.user.uid);

    if (!allowed.includes(entity as any)) {
      // Auth present, but capability not allowed → 403
      // expected: wrong-audience token — session noise, muted from the tracker.
      throw createCustomError(
        ERROR_CODES.SERVER.AUTH.FORBIDDEN, // 204
        `You must be ${allowed.join(" or ")} to access this route`,
        { status: 403, expected: true },
      );
    }

    next();
  });
}

/**
 * ADMIN is deliberately NOT allow-listed on the customer/advertiser gates.
 *
 * Everything behind these two mounts scopes by the bare numeric `req.user.id`,
 * and `Admin`/`Customer`/`Advertiser` are independent autoincrement sequences —
 * so admitting an admin token here makes an admin operate as whichever customer
 * or advertiser happens to share their primary key (Stripe dashboard links,
 * withdrawals, business deletion, push-token rebinding), and lets a non-SUPER
 * admin walk around the `requireSuperAdmin` gate that protects every
 * `/v2/admin` data route. Admins reach their own data through `/v2/admin/*`.
 *
 * These constants gate the per-group mounts in `routes/v2/index.ts`. No admin
 * client depends on the entry: `tagly-admin` imports only
 * `@tagly/sdk/v2/adminApp`, which calls only `/v2/admin/*`.
 */
export const requireAdvertiserCapability = requireCapability(["ADVERTISER"]);
export const requireCustomerCapability = requireCapability(["CUSTOMER"]);
export const requireAdminCapability = requireCapability(["ADMIN"]);
