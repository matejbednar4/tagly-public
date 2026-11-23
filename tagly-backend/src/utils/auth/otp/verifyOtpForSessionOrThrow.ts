import { OTP } from "../../../constants/auth/OTP.js";
import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import bcrypt from "bcrypt";
import { resendOtpForSession } from "./resendOtpForSession.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { OtpPurpose } from "../../../generated/prisma/enums.js";
import { ERROR_CODES } from "@tagly/models/shared";

/**
 * Verifies an OTP code against a stored session.
 *
 * Claims one attempt with a conditional increment (the atomic CAS below), then
 * compares the provided code against the session's bcrypt hash. Deletes the
 * session on success to prevent reuse. Can optionally resend a new OTP if the
 * current one is expired.
 *
 * @throws SESSION_NOT_FOUND - OTP session doesn't exist or wrong purpose
 * @throws EXPIRED - OTP has expired
 * @throws TOO_MANY_ATTEMPTS - Max verification attempts exceeded
 * @throws INVALID - OTP code doesn't match
 */
export async function verifyOtpForSessionOrThrow({
  otpSessionId,
  code,
  expectedPurpose,
  resendIfExpired = false,
  deleteOnSuccess = true,
}: {
  otpSessionId: number;
  code: string;
  expectedPurpose: OtpPurpose;
  resendIfExpired?: boolean;
  /**
   * Delete the session on a successful match (default). Pass `false` to verify
   * without consuming — e.g. the dual-OTP email change verifies BOTH codes first
   * and only deletes them together once both pass, so a single wrong code can't
   * consume the other's session and force a restart.
   */
  deleteOnSuccess?: boolean;
}) {
  const now = new Date();

  const session = await prisma.otpSession.findUnique({
    where: { id: otpSessionId },
  });

  // OTP-flow failures are TRACKED — we want to see send/resend/validate friction
  // (sessions lost, codes expiring, lockouts). The one exception is a plain wrong
  // code (`INVALID`), which is just a user typo → `expected: true` (muted).
  if (!session || session.purpose !== expectedPurpose) {
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.SESSION_NOT_FOUND,
      "OTP session not found",
      404
    );
  }

  if (now > session.otpExpiresAt) {
    if (resendIfExpired) {
      await resendOtpForSession({ otpSessionId });
      throw createCustomError(
        ERROR_CODES.SERVER.OTP.EXPIRED_NEW_SENT,
        "OTP expired, a new one was sent",
        400
      );
    }

    throw createCustomError(ERROR_CODES.SERVER.OTP.EXPIRED, "OTP expired", 400);
  }

  // Claim one attempt ATOMICALLY, before the (slow) bcrypt compare. Reading
  // `attempts`, comparing, then writing back `attempts + 1` is a real
  // brute-force hole rather than a tight race: every request in a concurrent
  // batch reads the same value and writes back the same value + 1, so the
  // lockout advances once per BATCH instead of once per guess — and the window
  // is a whole cost-12 bcrypt compare (~300ms) wide, so it is trivially hit.
  // That matters because the rate limiters are keyed per IP; this counter is
  // the only per-account bound, i.e. the only one an attacker with a proxy pool
  // can't widen. The conditional increment makes MAX_ATTEMPTS mean what it says.
  //
  // A correct code also consumes an attempt. That's harmless: success deletes
  // the session, and the one `deleteOnSuccess: false` caller (the dual-OTP
  // email change) verifies both codes on every request, so the two counters
  // move together and the user still gets MAX_ATTEMPTS tries at the pair.
  //
  // `otpHash` is re-read as part of the claim rather than reused from the
  // findUnique above, so a resend landing in between is compared against the
  // code that is actually live, not the one it replaced.
  let claimed: { attempts: number; otpHash: string };
  try {
    claimed = await prisma.otpSession.update({
      where: { id: otpSessionId, attempts: { lt: OTP.MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, otpHash: true },
    });
  } catch (err) {
    // P2025 = no row matched the filter, i.e. the attempts budget is spent.
    // Anything else is a real failure and must not read as a lockout.
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2025"
    ) {
      throw err;
    }

    if (resendIfExpired) {
      await resendOtpForSession({ otpSessionId });
      throw createCustomError(
        ERROR_CODES.SERVER.OTP.TOO_MANY_ATTEMPTS_NEW_SENT,
        "Too many attempts, a new OTP was sent",
        429
      );
    }
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.TOO_MANY_ATTEMPTS,
      "Too many attempts",
      429
    );
  }

  const isMatch = await bcrypt.compare(code, claimed.otpHash);

  if (!isMatch) {
    if (claimed.attempts >= OTP.MAX_ATTEMPTS) {
      throw createCustomError(
        ERROR_CODES.SERVER.OTP.TOO_MANY_ATTEMPTS,
        "Too many attempts",
        429
      );
    }

    // expected: a plain wrong code is a user typo — muted from the tracker.
    throw createCustomError(ERROR_CODES.SERVER.OTP.INVALID, "Invalid OTP", {
      status: 400,
      expected: true,
    });
  }

  if (deleteOnSuccess) {
    await prisma.otpSession.delete({
      where: { id: otpSessionId },
    });
  }
}
