import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  AdminLoginBodySchema,
  AdminVerifyOtpBodySchema,
} from "@tagly/models/v2/adminApp";
import { login } from "../../../../../controllers/v2/adminApp/auth/login.js";
import { verifyOtp } from "../../../../../controllers/v2/adminApp/auth/verifyOtp.js";

/**
 * `/v2/public/auth/admin` — unauthenticated admin login (team email +
 * password → long emailed code → bearer JWT). Public; the parent `/auth` mount
 * applies `authIpLimiter`, so both routes inherit the stricter auth IP limit.
 * No OAuth, no self-signup, no resend endpoint (admin accounts are provisioned).
 */
const r = Router();

r.post("/login", validateReq("body", AdminLoginBodySchema), login);
r.post("/verify", validateReq("body", AdminVerifyOtpBodySchema), verifyOtp);

export default r;
