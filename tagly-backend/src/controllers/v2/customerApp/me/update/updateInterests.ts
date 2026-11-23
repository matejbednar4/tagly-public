import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import { ACCOUNT_UPDATE_COOLDOWNS } from "@tagly/models/shared";
import type { UpdateInterestsBody } from "@tagly/models/v2/customerApp";

/**
 * The `InterestInList` projection (matches `hydrateCustomerMe`), so the update
 * response carries the same interest shape `/me` returns.
 */
const interestSelect = {
  id: true,
  slug: true,
  sortOrder: true,
  verticals: { select: { id: true } },
} as const;

/**
 * `POST /v2/customers/me/update/interests` — replace the customer's follower
 * interests (up to 3) with cooldown enforcement. v2 wire uses interest **slugs**
 * (`Interest.slug` is unique; the DB is seeded from the same `@tagly/models`
 * catalog the client picks from), resolved via `{ set: [{ slug }] }`.
 *
 * Setting a non-empty list (1..3) is gated by a 60-day cooldown, enforced
 * atomically (the guard `updateMany` bumps `interestsUpdatedAt` to now only when
 * the cooldown has elapsed); a blocked change returns 1442 with the next-allowed
 * time. Clearing to an empty set is always allowed and deliberately leaves the
 * timestamp untouched — so removing interests is free, but it can't reset the
 * timer to bypass the cooldown (re-setting is still gated by the last set).
 */
export const updateInterests: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { interestSlugs } = req.validatedBody as UpdateInterestsBody;
    const slugs = Array.from(new Set(interestSlugs)); // distinct

    // Clearing (empty) is always allowed and deliberately leaves `interestsUpdatedAt`
    // untouched — it neither bumps nor resets the cooldown timer. So a user can
    // remove their interests anytime, but "clear then re-set" can't dodge the
    // cooldown: re-setting is still gated by the last time a non-empty list was set.
    if (slugs.length === 0) {
      const cleared = await prisma.customer.update({
        where: { id: customerId },
        data: { interests: { set: [] } },
        select: {
          interestsUpdatedAt: true,
          interests: { select: interestSelect },
        },
      });
      // Interests feed the reward estimate — invalidate this customer's cache.
      await bumpCustomerRewardEstGen(customerId);
      res.status(200).json({
        interests: cleared.interests,
        interestsUpdatedAt: cleared.interestsUpdatedAt,
      });
      return;
    }

    // Setting 1..3 → enforce the cooldown atomically (bump the timestamp only when
    // the cooldown has elapsed).
    const now = new Date();
    const cutoff = new Date(
      now.getTime() - ACCOUNT_UPDATE_COOLDOWNS.interestsMs,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const bump = await tx.customer.updateMany({
        where: {
          id: customerId,
          OR: [
            { interestsUpdatedAt: null },
            { interestsUpdatedAt: { lte: cutoff } },
          ],
        },
        data: { interestsUpdatedAt: now },
      });

      if (bump.count === 0) {
        const current = await tx.customer.findUnique({
          where: { id: customerId },
          select: { interestsUpdatedAt: true },
        });
        if (!current) {
          throw createCustomError(1711, "customer not found", 404);
        }
        const nextAllowedAt = new Date(
          (current.interestsUpdatedAt?.getTime() ?? now.getTime()) +
            ACCOUNT_UPDATE_COOLDOWNS.interestsMs,
        );
        throw createCustomError(
          1442,
          `interests on cooldown; next allowed at ${nextAllowedAt.toISOString()}`,
          403,
        );
      }

      return tx.customer.update({
        where: { id: customerId },
        data: { interests: { set: slugs.map((slug) => ({ slug })) } },
        select: { interests: { select: interestSelect } },
      });
    });

    // Interests feed the reward estimate — invalidate this customer's cache.
    await bumpCustomerRewardEstGen(customerId);

    res.status(200).json({
      interests: updated.interests,
      interestsUpdatedAt: now,
    });
  },
);
