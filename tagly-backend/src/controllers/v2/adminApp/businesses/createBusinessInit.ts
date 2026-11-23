import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createBusinessInitCore } from "../../../../utils/businesses/write/createBusinessInitCore.js";
import type {
  AdminCreateBusinessInitBody,
  AdminCreateBusinessInitResponse,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/businesses/init` — phase 1 of an admin creating a business
 * page. The created page is UNOWNED
 * (`advertiserId: null` — the subsidized track); subsidizing it (opening a
 * `SubsidizationPeriod`) is a separate admin action. Unowned also means NO
 * locale ↔ country invariant — an admin may create a page in any market.
 *
 * Thin wire adapter over `createBusinessInitCore` (shared with the advertiser
 * create); SUPER-gated in the router.
 */
export const createBusinessInit: RequestHandler = asyncHandler(
  async (req, res) => {
    const body = req.validatedBody as AdminCreateBusinessInitBody;

    const result = await createBusinessInitCore({ kind: "admin" }, body);

    res.status(201).json(result satisfies AdminCreateBusinessInitResponse);
  },
);
