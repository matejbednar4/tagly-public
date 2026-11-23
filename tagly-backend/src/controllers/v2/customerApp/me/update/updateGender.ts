import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import type { UpdateGenderBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/gender` — update the logged-in customer's gender.
 * No cooldown: gender can be changed freely. `genderUpdatedAt` still records when
 * a concrete value was last set (null when cleared to `UNSPECIFIED`).
 */
export const updateGender: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { gender } = req.validatedBody as UpdateGenderBody;
  const genderUpdatedAt = gender === "UNSPECIFIED" ? null : new Date();

  const updated = await prisma.customer.updateMany({
    where: { id: customerId },
    data: { gender, genderUpdatedAt },
  });
  if (updated.count === 0) {
    throw createCustomError(1711, "customer not found", 404);
  }

  res.status(200).json({ gender, genderUpdatedAt });
});
