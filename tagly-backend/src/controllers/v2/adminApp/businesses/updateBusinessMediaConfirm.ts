import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { updateBusinessMediaConfirmCore } from "../../../../utils/businesses/write/updateBusinessMediaConfirmCore.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import type {
  AdminBusinessUidParams,
  AdminUpdateBusinessMediaConfirmBody,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/businesses/:uid/media/confirm` — phase 2 of an admin
 * editing a business page's banner/photos. Keep-by-uid semantics
 * (`keepPhotoUids` is the authoritative keep list; a pure removal calls
 * confirm directly). The `pendingLocalId: null` guard (rows must come from
 * media init, not a create flow) lives inside the core.
 *
 * Thin wire adapter over `updateBusinessMediaConfirmCore` (shared with the
 * advertiser media edit); returns the full `AdminBusiness`; SUPER-gated.
 */
export const updateBusinessMediaConfirm: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;
    const body = req.validatedBody as AdminUpdateBusinessMediaConfirmBody;

    const { localId } = await updateBusinessMediaConfirmCore(
      { kind: "admin" },
      uid,
      body,
    );

    const [business] = await adminHydrateLocal({ localIds: [localId] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    // No `satisfies` — the hydrator emits the schema's INPUT shape (Date /
    // bigint before coercion), same as every other hydrated admin response.
    res.status(200).json({
      message: "Business media updated successfully",
      business,
    });
  },
);
