import crypto from "crypto";
import bcrypt from "bcrypt";
import { ADMIN } from "../../../constants/platform/ADMIN.js";
import { OTP } from "../../../constants/auth/OTP.js";

export default async function generateNumericOtpAndHash(): Promise<{
  otp: string;
  otpHash: string;
  otpExpiresAt: Date;
}> {
  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const otpHash = await bcrypt.hash(otp, OTP.HASH_ROUNDS);

  const now = new Date();
  const otpExpiresAt = new Date(now.getTime() + OTP.EXPIRATION_MS);
  return { otp, otpHash, otpExpiresAt };
}

/**
 * Generates a long, high-entropy code (32 random bytes → 64 hex chars) + bcrypt
 * hash, for admin login. Admin auth is a real second factor (not a 6-digit
 * convenience code), so it uses a 128-bit emailed code instead of the numeric
 * OTP — preserving the origin admin flow's `crypto.randomBytes(32)` code.
 *
 * Expiry is `ADMIN.OTP_EXPIRATION_MS` (3 min), NOT the 15-min `OTP.EXPIRATION_MS`
 * the numeric codes use: the admin window is deliberately tighter than the
 * customer/advertiser one. Composing the shared numeric-OTP expiry here silently
 * widened it 3 min → 15 min, so keep this reading the ADMIN constant.
 */
export async function generateLongCodeAndHash(): Promise<{
  otp: string;
  otpHash: string;
  otpExpiresAt: Date;
}> {
  const otp = crypto.randomBytes(32).toString("hex");
  const otpHash = await bcrypt.hash(otp, OTP.HASH_ROUNDS);

  const now = new Date();
  const otpExpiresAt = new Date(now.getTime() + ADMIN.OTP_EXPIRATION_MS);
  return { otp, otpHash, otpExpiresAt };
}
