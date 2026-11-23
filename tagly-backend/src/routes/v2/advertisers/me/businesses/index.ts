import { Router } from "express";
import {
  CreateBusinessInitBodySchema,
  CreateBusinessConfirmBodySchema,
  GetBusinessByUidParamsSchema,
  UpdateBusinessBodySchema,
  UpdateBusinessMediaInitBodySchema,
  UpdateBusinessMediaConfirmBodySchema,
} from "@tagly/models/v2/advertiserApp";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import { createBusinessInit } from "../../../../../controllers/v2/advertiserApp/businesses/createBusinessInit.js";
import { createBusinessConfirm } from "../../../../../controllers/v2/advertiserApp/businesses/createBusinessConfirm.js";
import { getBusinesses } from "../../../../../controllers/v2/advertiserApp/businesses/getBusinesses.js";
import { getBusinessByUid } from "../../../../../controllers/v2/advertiserApp/businesses/getBusinessByUid.js";
import { updateBusiness } from "../../../../../controllers/v2/advertiserApp/businesses/updateBusiness.js";
import { updateBusinessMediaInit } from "../../../../../controllers/v2/advertiserApp/businesses/updateBusinessMediaInit.js";
import { updateBusinessMediaConfirm } from "../../../../../controllers/v2/advertiserApp/businesses/updateBusinessMediaConfirm.js";
import { deleteBusiness } from "../../../../../controllers/v2/advertiserApp/businesses/deleteBusiness.js";

/**
 * `/v2/advertisers/me/businesses/**` — the advertiser's own business pages
 * (local subaccounts). `GET /` lists the non-deleted pages as owner previews;
 * creation is the two-phase init (pending row + presigned uploads) → confirm
 * (validate media, promote, write details) pattern. Editing is `PATCH /:uid`
 * for data (name/type/address/details/hours/links) plus the two-phase
 * `/:uid/media/{init,confirm}` for banner/photos; `DELETE /:uid` is the
 * two-stage removal (DELETED now, worker-purged once shares settle).
 */
const r = Router();

r.get("/", getBusinesses);
r.post("/init", validateReq("body", CreateBusinessInitBodySchema), createBusinessInit);
r.post(
  "/confirm",
  validateReq("body", CreateBusinessConfirmBodySchema),
  createBusinessConfirm,
);
r.get(
  "/:uid",
  validateReq("params", GetBusinessByUidParamsSchema),
  getBusinessByUid,
);
r.patch(
  "/:uid",
  validateReq("params", GetBusinessByUidParamsSchema),
  validateReq("body", UpdateBusinessBodySchema),
  updateBusiness,
);
r.delete(
  "/:uid",
  validateReq("params", GetBusinessByUidParamsSchema),
  deleteBusiness,
);
r.post(
  "/:uid/media/init",
  validateReq("params", GetBusinessByUidParamsSchema),
  validateReq("body", UpdateBusinessMediaInitBodySchema),
  updateBusinessMediaInit,
);
r.post(
  "/:uid/media/confirm",
  validateReq("params", GetBusinessByUidParamsSchema),
  validateReq("body", UpdateBusinessMediaConfirmBodySchema),
  updateBusinessMediaConfirm,
);

export default r;
