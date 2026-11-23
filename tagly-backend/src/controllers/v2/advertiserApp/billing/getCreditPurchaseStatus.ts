import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import type {
  CreditPurchasePollStatus,
  GetCreditPurchaseStatusParams,
  GetCreditPurchaseStatusResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/billing/credit-purchases/:uid` — read the current
 * status of one of the advertiser's own credit purchases. Pure read, no
 * side effects: crediting stays exclusively webhook-driven
 * (`payment_intent.succeeded`). The client polls this right after the
 * PaymentSheet succeeds so it only shows success once the credits are actually
 * booked.
 *
 * The DB lifecycle is collapsed to the poll vocabulary: the refund states
 * count as COMPLETED (the payment itself went through), CANCELED counts as
 * FAILED. IDOR-safe: the row is looked up by uid + advertiserId.
 */
export const getCreditPurchaseStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { uid } = req.validatedParams as GetCreditPurchaseStatusParams;

    const purchase = await prisma.stripeCreditPurchase.findFirst({
      where: { uid, advertiserId },
      select: { status: true },
    });
    if (!purchase) {
      // A missing row is an operational 404 (bad uid / foreign purchase), not
      // product signal worth tracking.
      throw createCustomError(1341, "credit purchase not found", {
        status: 404,
        expected: true,
      });
    }

    const status: CreditPurchasePollStatus =
      purchase.status === "COMPLETED" ||
      purchase.status === "REFUNDED" ||
      purchase.status === "PARTIALLY_REFUNDED"
        ? "COMPLETED"
        : purchase.status === "PENDING"
          ? "PENDING"
          : "FAILED";

    res
      .status(200)
      .json({ status } satisfies GetCreditPurchaseStatusResponse);
  },
);
