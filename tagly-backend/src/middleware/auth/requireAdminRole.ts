import type { RequestHandler } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { asyncHandler } from "../../utils/core/http/asyncHandler.js";
import prisma from "../../prisma/prisma.js";
import { AdminRole } from "../../generated/prisma/enums.js";

/**
 * Middleware to require specific admin role(s) for a route.
 * Must be used after verifyJwt and requireAdminCapability.
 *
 * @param allowedRoles - Array of allowed AdminRole values
 */
export function requireAdminRole(
  allowedRoles: AdminRole[]
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const adminId = req.user?.id;

    if (!adminId) {
      throw createCustomError(4900, "Admin not authenticated", 401);
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin) {
      throw createCustomError(4901, "Admin not found", 404);
    }

    if (!allowedRoles.includes(admin.role)) {
      throw createCustomError(
        4902,
        `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        403
      );
    }

    next();
  });
}

// Pre-configured middleware for common role checks
export const requireSuperAdmin = requireAdminRole(["SUPER"]);
export const requireSuperOrOpsAdmin = requireAdminRole(["SUPER", "OPS"]);
export const requireSuperOrSupportAdmin = requireAdminRole(["SUPER", "SUPPORT"]);
