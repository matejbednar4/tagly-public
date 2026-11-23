import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import { GetCustomerTransactionsBodySchema } from "@tagly/models/v2/customerApp";
import { getCustomerTransactions } from "../../../../controllers/v2/customerApp/transactions/getTransactions.js";

/**
 * `/v2/customers/transactions/**` — the logged-in customer's money history.
 *   - `POST /`  offset-paginated feed (earnings + withdrawals), optional type filter
 */
const r = Router();

r.post(
  "/",
  validateReq("body", GetCustomerTransactionsBodySchema),
  getCustomerTransactions,
);

export default r;
