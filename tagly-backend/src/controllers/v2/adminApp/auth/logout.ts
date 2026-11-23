import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type { AdminLogoutResponse } from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/logout` — real server-side revocation. Bumps the admin's
 * `jwtVersion` so every live token that admin holds fails at `verifyJwt` (which
 * checks the version); the client also discards its stored bearer. Behind
 * `verifyJwt → requireAdminCapability`, so `req.user.id` is a valid active admin.
 */
export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user.id;

  await prisma.admin.update({
    where: { id: adminId },
    data: { jwtVersion: { increment: 1 } },
  });

  res.status(200).json({ message: "Logged out" } satisfies AdminLogoutResponse);
});
