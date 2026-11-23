import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { asyncHandler } from "../../utils/core/http/asyncHandler.js";
import { ERROR_CODES } from "@tagly/models/shared";
import { envVariables } from "../../environment/envVariables.js";
import prisma from "../../prisma/prisma.js";
import { getEntityFromUid } from "../../utils/core/uids/getEntityFromUid.js";
import { ACCEPTED_TOKEN_ISSUERS } from "../../constants/auth/JWT.js";

type JwtPayload = {
  id: number;
  uid: string;
  v?: number; // tokens must carry version
  iat?: number;
  exp: number;
};

/**
 * The session token travels ONLY as `Authorization: Bearer <jwt>`. Every client
 * is a native app holding its JWT in secure storage (the browser surfaces —
 * join page, website — only hit unauthenticated `/v2/public/*`), so there is no
 * cookie fallback and nothing to clear on failure: the client drops its own
 * token when it sees a 401.
 */
function getTokenFromRequest(req: any): string | undefined {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.length > 0) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }
  return undefined;
}

// expected: session-level auth failure (expired/invalid/missing token) — normal
// client churn, not a backend bug, so it's muted from the error tracker.
function authError(code: number, message: string, status: number): never {
  throw createCustomError(code, message, { status, expected: true });
}

export const verifyJwt: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
      authError(
        ERROR_CODES.SERVER.AUTH.MISSING, // 200
        "Unauthorized",
        401,
      );
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, envVariables.JWT_SECRET, {
        issuer: ACCEPTED_TOKEN_ISSUERS,
      }) as JwtPayload;
    } catch {
      authError(
        ERROR_CODES.SERVER.AUTH.INVALID_JWT, // 202
        "Invalid or expired JWT",
        401,
      );
    }

    if (!decoded?.id || !decoded?.uid) {
      authError(
        ERROR_CODES.SERVER.AUTH.INVALID_JWT, // 202
        "Invalid or expired JWT",
        401,
      );
    }

    // Require version claim
    if (typeof decoded.v !== "number") {
      authError(ERROR_CODES.SERVER.AUTH.INVALID_JWT, "Session expired", 401);
    }

    // Check against DB
    const entity = getEntityFromUid(decoded.uid);
    if (entity === "ADVERTISER") {
      const u = await prisma.advertiser.findUnique({
        where: { id: decoded.id },
        select: { jwtVersion: true },
      });
      if (!u) {
        authError(
          ERROR_CODES.SERVER.AUTH.USER_NOT_FOUND,
          "Account not found",
          404,
        );
      }
      if (decoded.v !== u.jwtVersion) {
        authError(ERROR_CODES.SERVER.AUTH.INVALID_JWT, "Session expired", 401);
      }
    } else if (entity === "CUSTOMER") {
      const u = await prisma.customer.findUnique({
        where: { id: decoded.id },
        select: { jwtVersion: true },
      });
      if (!u) {
        authError(
          ERROR_CODES.SERVER.AUTH.USER_NOT_FOUND,
          "Account not found",
          404,
        );
      }
      if (decoded.v !== u.jwtVersion) {
        authError(ERROR_CODES.SERVER.AUTH.INVALID_JWT, "Session expired", 401);
      }
    } else if (entity === "ADMIN") {
      const u = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: { jwtVersion: true, isActive: true },
      });
      if (!u) {
        authError(
          ERROR_CODES.SERVER.AUTH.USER_NOT_FOUND,
          "Account not found",
          404,
        );
      }
      if (!u.isActive) {
        authError(
          ERROR_CODES.SERVER.AUTH.FORBIDDEN,
          "Account is not active",
          401,
        );
      }
      if (decoded.v !== u.jwtVersion) {
        authError(ERROR_CODES.SERVER.AUTH.INVALID_JWT, "Session expired", 401);
      }
    } else {
      authError(
        ERROR_CODES.SERVER.AUTH.INVALID_JWT, // 202
        "Invalid or expired JWT",
        401,
      );
    }

    req.user = { id: decoded.id, uid: decoded.uid };
    next();
  },
);
