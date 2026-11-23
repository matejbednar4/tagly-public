import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { ERROR_CODES } from "@tagly/models/shared";
import type { AdminGetMeResponse } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/me` — the authenticated admin's profile (uid, email, username,
 * role). Behind `verifyJwt → requireAdminCapability`, so `req.user.id` is a valid
 * active admin's id (verifyJwt already re-checked `isActive` + `jwtVersion`).
 */
export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user.id;

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { uid: true, email: true, username: true, role: true },
  });

  if (!admin) {
    throw createCustomError(
      ERROR_CODES.SERVER.AUTH.USER_NOT_FOUND,
      "Admin not found",
      404,
    );
  }

  res.status(200).json({
    uid: admin.uid,
    email: admin.email,
    username: admin.username,
    role: admin.role,
  } satisfies AdminGetMeResponse);
});
