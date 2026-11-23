import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { createBusinessConfirmCore } from "../../../../utils/businesses/write/createBusinessConfirmCore.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type { AdminCreateBusinessConfirmBody } from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/businesses/confirm` — phase 2 of an admin creating a
 * business page. Runs the shared core in full: profanity gate, the
 * admin-reviewed `Link` registry (Safe Browsing), and the detail fields
 * (description, links, phone, contact email, opening hours) written
 * atomically at promotion. The admin-only `tags` (search aliases) ride the
 * body too.
 *
 * The core's claim is scoped to `advertiserId: null` — a safety guard: an
 * admin confirm can never claim an advertiser's pending row.
 *
 * Thin wire adapter over `createBusinessConfirmCore` (shared with the
 * advertiser create); returns the full `AdminBusiness`; SUPER-gated.
 */
export const createBusinessConfirm: RequestHandler = asyncHandler(
  async (req, res) => {
    const body = req.validatedBody as AdminCreateBusinessConfirmBody;

    const { localId } = await createBusinessConfirmCore(
      { kind: "admin" },
      body,
    );

    const [business] = await adminHydrateLocal({ localIds: [localId] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    // No `satisfies` — the hydrator emits the schema's INPUT shape (Date /
    // bigint before coercion), same as every other hydrated admin response.
    res.status(201).json({
      message: "Business created successfully",
      business,
    });
  },
);
