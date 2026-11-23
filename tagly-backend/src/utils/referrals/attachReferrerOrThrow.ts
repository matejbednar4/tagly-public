import type { Prisma } from "../../generated/prisma/client.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { ACCOUNT_UPDATE_COOLDOWNS } from "@tagly/models/shared";

/**
 * Creates the `ReferralEvent` that records "X referred this account" — the link
 * that later drives referral payouts (`findReferrer` reads it back at
 * settlement). The single write-side chokepoint for the post-signup attach
 * paths, shared by all three v2 callers:
 *
 *   - `customerApp/me/update/updateReferrerCode`   (24h window)
 *   - `advertiserApp/me/update/updateReferrerCode` (24h window)
 *   - `adminApp/advertisers/setAdvertiserReferrer` (no window, stamps the admin)
 *
 * The caller loads its own account (it needs the row for its own 404 anyway)
 * and hands over that account's `accountReferral`; everything downstream of
 * that is identical, so it lives here. Guard order is fixed and matters —
 * already-referred beats the sign-up window, which beats an unknown code — so
 * the window is a parameter (`signUpWindowFrom`) rather than something a caller
 * checks before calling.
 *
 * Financial-adjacent: run it inside the caller's transaction so the load →
 * guard → create can't interleave with a concurrent attach. The
 * `referredCodeId` unique index is the final backstop.
 *
 * Error ladder (one meaning per code, platform-wide): already referred
 * `1003`/409, sign-up window expired `1006`/403, unknown or inactive code
 * `1004`/404, own code `1005`/409, code with no single owner account
 * `1007`/409.
 */
export async function attachReferrerOrThrow({
  tx,
  accountReferral,
  referrerCode,
  signUpWindowFrom,
  setByAdminId,
  adminReason,
}: {
  tx: Prisma.TransactionClient;
  /** The referred account's own code row: `{ id, referredEvent }`. */
  accountReferral: { id: number; referredEvent: { id: number } | null };
  referrerCode: string;
  /**
   * When set, the attach is only allowed within
   * `ACCOUNT_UPDATE_COOLDOWNS.referrerCodeSinceCreatedMs` of this instant (pass
   * the account's `createdAt`). Omit to skip the window — admin fixes a
   * referral precisely because the window is long gone.
   */
  signUpWindowFrom?: Date;
  /** Stamped when an admin attached this after the fact; the audit trail. */
  setByAdminId?: number;
  adminReason?: string | null;
}): Promise<{
  referralEventId: number;
  createdAt: Date;
  referrerCode: string;
  referrerUid: string;
  referrerType: "customer" | "advertiser";
}> {
  // One-time: can't change who referred you once it's set.
  if (accountReferral.referredEvent !== null) {
    throw createCustomError(1003, "you have already set who referred you", 409);
  }

  if (signUpWindowFrom) {
    const sinceCreatedMs = Date.now() - signUpWindowFrom.getTime();
    if (
      sinceCreatedMs < 0 ||
      sinceCreatedMs > ACCOUNT_UPDATE_COOLDOWNS.referrerCodeSinceCreatedMs
    ) {
      throw createCustomError(
        1006,
        "referrer can only be set within the sign-up window",
        403,
      );
    }
  }

  const referrer = await tx.accountReferral.findFirst({
    where: { code: referrerCode, status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      customer: { select: { uid: true } },
      advertiser: { select: { uid: true } },
    },
  });
  if (!referrer) {
    throw createCustomError(1004, "invalid referrer code", 404);
  }
  if (referrer.id === accountReferral.id) {
    throw createCustomError(1005, "referrer code cannot be your own", 409);
  }

  // Data integrity: exactly one owner kind. `findReferrer` returns null (and
  // silently drops the payout) for a code owned by neither or both, so refuse
  // to create an event that could never pay out.
  const referrerUid = referrer.customer?.uid ?? referrer.advertiser?.uid;
  if (!referrerUid || (referrer.customer && referrer.advertiser)) {
    throw createCustomError(
      1007,
      "referrer code has no single owner account",
      409,
    );
  }

  const event = await tx.referralEvent.create({
    data: {
      referredCodeId: accountReferral.id,
      referrerCodeId: referrer.id,
      ...(setByAdminId != null ? { setByAdminId } : null),
      ...(adminReason ? { adminReason } : null),
    },
    select: { id: true, createdAt: true },
  });

  return {
    referralEventId: event.id,
    createdAt: event.createdAt,
    referrerCode: referrer.code,
    referrerUid,
    referrerType: referrer.customer ? "customer" : "advertiser",
  };
}
