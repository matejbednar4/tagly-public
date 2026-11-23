import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { updateBusinessCore } from "../../../../utils/businesses/write/updateBusinessCore.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type {
  AdminBusinessUidParams,
  AdminUpdateBusinessBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/businesses/:uid` — edit ANY business page (owned or
 * unowned, ACTIVE or BANNED; only DELETED 404s). One PATCH covers data +
 * address, through the shared core: profanity gate, `Link` registry, atomic
 * address+PostGIS write, and the reward-est cache bump on type/address
 * change. The locale ↔ country invariant applies only when the page HAS an
 * advertiser (an unowned page may be moved between markets freely). `tags`
 * is admin-only.
 *
 * Thin wire adapter over `updateBusinessCore` (shared with the advertiser
 * PATCH); returns the full `AdminBusiness`; SUPER-gated.
 */
export const updateBusiness: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = req.validatedParams as AdminBusinessUidParams;
  const body = req.validatedBody as AdminUpdateBusinessBody;

  const { localId } = await updateBusinessCore({ kind: "admin" }, uid, body);

  const [business] = await adminHydrateLocal({ localIds: [localId] });
  if (!business) throw createCustomError(4043, "Business not found", 404);

  // No `satisfies` — the hydrator emits the schema's INPUT shape (Date /
  // bigint before coercion), same as every other hydrated admin response.
  res.status(200).json({
    message: "Business updated successfully",
    business,
  });
});
