import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { getAdvertiserRegistrationResumeState } from "../../../../utils/auth/getAdvertiserRegistrationResumeState.js";
import type {
  CheckRegistrationQuery,
  CheckRegistrationResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/public/auth/advertisers/check-registration` — on app launch, resolve
 * where to resume onboarding from a stored registrationToken. Requires the email
 * to have been verified already.
 *
 * Lives at the `auth/` root (not under `register/`, no step number) because it
 * is a launch-time resume resolver called from the entry screen — it routes the
 * user into the correct onboarding step rather than being a step in the sequence
 * itself.
 */
export const checkRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const { registrationToken } = req.validatedQuery as CheckRegistrationQuery;

    const pending = await prisma.pendingAdvertiserAccount.findUnique({
      where: { registrationToken, emailVerified: true },
      select: { id: true, locale: true, promoNotificationsEnabled: true },
    });
    if (!pending) {
      throw createCustomError(2322, "Pending registration not found", 404);
    }

    // This resolver runs on every app launch of a mid-registration advertiser,
    // so it doubles as their "last active" signal: stamp lastSeenAt on their
    // push tokens (disabled included — activity is activity) so the promo
    // waterfall can skip the escalation email when a pending advertiser came
    // back after the push. Best-effort — never block the resume flow on it.
    // Mirrors the customer checkRegistration.
    await prisma.pushToken
      .updateMany({
        where: { pendingAdvertiserId: pending.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});

    res
      .status(200)
      .json(
        getAdvertiserRegistrationResumeState(
          pending,
        ) satisfies CheckRegistrationResponse,
      );
  },
);
