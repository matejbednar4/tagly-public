import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { businessVisibleWhere } from "../../../../utils/businesses/businessAccessibility.js";
import hydrateBusinessPublicDetails from "../../../../utils/hydrators/businesses/hydrateBusinessPublicDetails.js";
import type {
  GetBusinessByUidParams,
} from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/businesses/:uid` — a single business's detail view.
 *
 * Resolves the business, then hydrates the full `BusinessPublicDetails`
 * (preview + reward estimate + photos).
 *
 * Deliberately gated on VISIBILITY only (not accessibility): a business the
 * customer already knows (visited list, an old share) must stay openable even
 * when unfunded. The wire signals the difference — the hydrated preview's
 * `isAccessible` carries the canonical accessibility rule, and the client
 * gates its "Earn here" CTA on it (E038).
 *
 * Every request returns a fresh body — deliberately no ETag/304 layer. The
 * response includes derived fields (reward estimate, `isLowBudget`) whose
 * inputs (budget, snapshots, rating multiplier) leave no `updatedAt` trail on
 * the business row, so a timestamp-probe ETag would pin them stale behind 304s.
 * Client-side staleness is bounded by the detail hook's `staleTime` instead,
 * and the expensive estimate is already Redis-cached (`getEstPricesCached`).
 */
export const getBusinessByUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as GetBusinessByUidParams;
    const customerId = req.user.id;

    // Canonical visibility gate — a DELETED/BANNED page is a 404 to customers.
    const lite = await prisma.localSubaccount.findFirst({
      where: { uid, ...businessVisibleWhere },
      select: { id: true },
    });
    if (!lite) throw createCustomError(4604, "Business not found", 404);

    const business = await hydrateBusinessPublicDetails({
      businessId: lite.id,
      customerId,
    });
    if (!business) throw createCustomError(4604, "Business not found", 404);

    res
      .status(200)
      .json({ message: "Business fetched successfully", business });
  },
);
