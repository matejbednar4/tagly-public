import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { hydrateCustomerMe } from "../../../../utils/hydrators/customers/hydrateCustomerMe.js";

/**
 * `GET /v2/customers/me` — return the logged-in customer's lean core profile.
 * Pure read: no writes, no aggregates. App-open side-effects (notification
 * defaults, push token, IG refresh) live in the separate on-app-open endpoint;
 * the heavier slices (statistics, referrals, shares, ledger, withdrawals) are
 * their own cached sub-resources.
 *
 * The response carries Zod-*input* values (raw `Date` / `BigInt`); the BigInt-
 * safe JSON serializer + the SDK's response schema coerce them to the wire
 * shape, so this isn't annotated with the `GetMeResponse` output type.
 */
export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const customer = await hydrateCustomerMe(req.user.id);

  res.status(200).json({ customer });
});
