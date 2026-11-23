import prisma from "../../prisma/prisma.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { ERROR_CODES } from "@tagly/models/shared";

/**
 * Throws if the customer is BANNED. BANNED customers can still log in, but are
 * not allowed to perform value-bearing actions (creating shares, withdrawing
 * money). Call this at the top of those controllers.
 *
 * @throws 1540 (403) if the customer is banned.
 */
export async function assertCustomerNotBannedOrThrow(
  customerId: number
): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { status: true },
  });

  if (customer?.status === "BANNED") {
    throw createCustomError(
      ERROR_CODES.DOMAIN.CUSTOMER_BANNED,
      "Account is banned",
      403
    );
  }
}
