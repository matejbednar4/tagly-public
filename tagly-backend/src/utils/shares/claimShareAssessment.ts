import type { Prisma, ReportType } from "../../generated/prisma/client.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { UNASSESSED_SHARE_WHERE } from "./shareAccess.js";
import {
  adjustCustomerMultiplierBps,
  multiplierDeltaForStars,
} from "../customers/adjustCustomerMultiplierBps.js";

export type ShareAssessmentAction =
  | { kind: "RATING"; rating: number }
  | { kind: "REPORT"; reportType: ReportType; reportMessage?: string | null };

/**
 * The single once-only share-assessment write, shared by the advertiser
 * (`submitShareAssessment`) and admin (`adminAssessShare`) controllers so the
 * once-only guarantee can never drift between them.
 *
 * Claims the assessment by stamping `ratedAt` from null (`updateMany` count —
 * two concurrent attempts can't both land; the loser gets 4093), then applies
 * the outcome:
 *   - RATING → store the half-stars + apply the star delta to the customer's
 *     rolling multiplier.
 *   - REPORT → file a PENDING ShareReport for admin review (no multiplier
 *     change — a reported share was never rated).
 *
 * Must run inside the caller's `$transaction`. The caller owns the visibility
 * / eligibility guards (IDOR, APPROVED-only, subsidized-only, the friendly
 * pre-check on `ratedAt`) and the post-commit side effects (reward-estimate
 * cache bump when `multiplierChanged`, notifications).
 */
export async function claimShareAssessment(
  tx: Prisma.TransactionClient,
  input: {
    shareId: number;
    customerId: number | null;
    action: ShareAssessmentAction;
    now?: Date;
  }
): Promise<{ multiplierChanged: boolean }> {
  const { shareId, customerId, action } = input;
  const now = input.now ?? new Date();

  const claimed = await tx.share.updateMany({
    where: { id: shareId, ...UNASSESSED_SHARE_WHERE },
    data:
      action.kind === "RATING"
        ? { rating: action.rating, ratedAt: now }
        : { ratedAt: now },
  });
  if (claimed.count === 0) {
    throw createCustomError(4093, "This share has already been assessed", 409);
  }

  let multiplierChanged = false;

  if (action.kind === "RATING") {
    const delta = multiplierDeltaForStars(action.rating);
    if (delta !== 0 && customerId != null) {
      await adjustCustomerMultiplierBps(tx, customerId, delta);
      multiplierChanged = true;
    }
  } else {
    await tx.shareReport.create({
      data: {
        shareId,
        reportType: action.reportType,
        reportMessage: action.reportMessage ?? null,
        status: "PENDING",
      },
    });
  }

  return { multiplierChanged };
}
