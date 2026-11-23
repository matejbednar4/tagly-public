import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import {
  GetBusinessesInRegionQuerySchema,
  GetBusinessesFromSearchQuerySchema,
  GetRecommendedBusinessesQuerySchema,
  GetMostPayingBusinessesQuerySchema,
  GetNearestBusinessesQuerySchema,
  GetAllBusinessesBodySchema,
  GetVisitedBusinessesBodySchema,
  GetBusinessByUidParamsSchema,
} from "@tagly/models/v2/customerApp";
import { getBusinessesInRegion } from "../../../../controllers/v2/customerApp/businesses/getBusinessesInRegion.js";
import { getBusinessesFromSearch } from "../../../../controllers/v2/customerApp/businesses/getBusinessesFromSearch.js";
import { getRecommendedBusinesses } from "../../../../controllers/v2/customerApp/businesses/getRecommendedBusinesses.js";
import { getMostPayingBusinesses } from "../../../../controllers/v2/customerApp/businesses/getMostPayingBusinesses.js";
import { getNearestBusinesses } from "../../../../controllers/v2/customerApp/businesses/getNearestBusinesses.js";
import { getAllBusinesses } from "../../../../controllers/v2/customerApp/businesses/getAllBusinesses.js";
import { getVisitedBusinesses } from "../../../../controllers/v2/customerApp/businesses/getVisitedBusinesses.js";
import { getBusinessByUid } from "../../../../controllers/v2/customerApp/businesses/getBusinessByUid.js";

/**
 * `/v2/customers/businesses/**` — business map + search + Discover shelves.
 *   - `GET  /in-region`    businesses inside a bounding box (map)
 *   - `GET  /search`       free-text business-name search
 *   - `GET  /recommended`  Discover "Recommended for you" shelf
 *   - `GET  /top-earning`  Discover "Earn the most" shelf
 *   - `GET  /nearest`      Discover "Near you" shelf
 *   - `POST /all`          paginated "browse all" directory (sort + vertical filter)
 *   - `POST /visited`      paginated businesses the customer has shared at
 *   - `GET  /:uid`         a single business's detail view (registered last so it
 *                          doesn't shadow the literal routes above)
 */
const r = Router();

r.get(
  "/in-region",
  validateReq("query", GetBusinessesInRegionQuerySchema),
  getBusinessesInRegion
);
r.get(
  "/search",
  validateReq("query", GetBusinessesFromSearchQuerySchema),
  getBusinessesFromSearch
);
r.get(
  "/recommended",
  validateReq("query", GetRecommendedBusinessesQuerySchema),
  getRecommendedBusinesses
);
r.get(
  "/top-earning",
  validateReq("query", GetMostPayingBusinessesQuerySchema),
  getMostPayingBusinesses
);
r.get(
  "/nearest",
  validateReq("query", GetNearestBusinessesQuerySchema),
  getNearestBusinesses
);
r.post(
  "/all",
  validateReq("body", GetAllBusinessesBodySchema),
  getAllBusinesses
);
r.post(
  "/visited",
  validateReq("body", GetVisitedBusinessesBodySchema),
  getVisitedBusinesses
);
// Registered last: a single-segment `:uid` would otherwise shadow the literal
// GET routes above (e.g. `/in-region`).
r.get(
  "/:uid",
  validateReq("params", GetBusinessByUidParamsSchema),
  getBusinessByUid
);

export default r;
