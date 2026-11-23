import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateCustomer from "../../../../utils/hydrators/admin/adminHydrateCustomer.js";
import type { AdminCustomerUidParams } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/customers/:uid` — one customer, hydrated into the full
 * `AdminCustomer` DTO (same hydrator the list/search endpoints use). Read-only,
 * SUPER-gated in the router.
 */
export const getCustomerByUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminCustomerUidParams;

    const row = await prisma.customer.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Customer not found", 404);

    const customer = await adminHydrateCustomer({ customerId: row.id });

    res.status(200).json({
      message: "Customer fetched successfully",
      customer,
    });
  },
);
