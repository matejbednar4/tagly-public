import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import { GetAdvertiserTransactionsBodySchema } from "@tagly/models/v2/advertiserApp";
import { getAdvertiserTransactions } from "../../../../controllers/v2/advertiserApp/transactions/getTransactions.js";

/**
 * `/v2/advertisers/transactions/**` — the logged-in advertiser's money history.
 *   - `POST /`  offset-paginated feed (deposits + spend + credits), optional type filter
 */
const r = Router();

r.post(
  "/",
  validateReq("body", GetAdvertiserTransactionsBodySchema),
  getAdvertiserTransactions,
);

export default r;
