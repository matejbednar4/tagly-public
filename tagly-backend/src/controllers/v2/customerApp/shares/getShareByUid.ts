import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import hydrateCustomerShareDetails from "../../../../utils/hydrators/shares/hydrateCustomerShareDetails.js";
import type { GetShareByUidParams } from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/shares/:uid` — a single share's detail view (the logged-in
 * customer's own share).
 *
 * IDOR-checks ownership (404 for both missing and not-yours, so existence never
 * leaks), then hydrates the full `CustomerShareDetails`.
 *
 * Every request returns a fresh body — deliberately no ETag/304 layer. The
 * detail derives from rows whose writers don't touch `share.updatedAt` (the
 * insights worker writes a separate `ShareInsights` row, a report review
 * updates only the `ShareReport` row), so a timestamp-probe ETag has to
 * enumerate every such relation and silently rots when one is missed. A plain
 * fresh read makes pull-to-refresh always reflect landed insights or a
 * resolved report; client-side staleness is bounded by the hook's `staleTime`.
 */
export const getShareByUid: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = req.validatedParams as GetShareByUidParams;
  const customerId = req.user.id;

  const lite = await prisma.share.findUnique({
    where: { uid },
    select: { id: true, customerId: true },
  });
  if (!lite || lite.customerId !== customerId) {
    throw createCustomError(4605, "Share not found", 404);
  }

  const share = await hydrateCustomerShareDetails({
    shareId: lite.id,
    customerId,
  });
  if (!share) throw createCustomError(4605, "Share not found", 404);

  res.status(200).json({ message: "Share fetched successfully", share });
});
