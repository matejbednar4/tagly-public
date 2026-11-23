import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { getDecryptedInstagramTokenForCustomer } from "../../../../../utils/instagram/tokens/getDecryptedIgTokenForCustomer.js";
import { checkUserInstagramPermission } from "../../../../../utils/instagram/permission/checkUserInstagramPermission.js";
import { getUserDataFromIG } from "../../../../../utils/instagram/accountInsights/getUserDataFromIg.js";
import { queueInstagramSnapshotJob } from "../../../../../utils/queue/queueInstagramSnapshotJob.js";
import { REFRESH_INSTAGRAM_SNAPSHOT_INTERVAL } from "../../../../../constants/platform/ACCOUNT_UPDATES.js";
import type { RefreshInstagramResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/instagram/refresh` — the cold-start IG probe.
 *
 * Flow:
 * 1. Decrypt (and proactively refresh) the customer's IG token — surfaces the
 *    DISCONNECTED / EXPIRED_TOKEN states via codes 5007/5008/5009/5110.
 * 2. Verify `instagram_manage_insights` permission — surfaces MISSING_PERMISSION
 *    via code 4099.
 * 3. Refresh the cached profile (username/pfp/follower count/account type).
 * 4. Opportunistically queue an audience snapshot when the latest is stale or
 *    missing. The IG snapshot worker drains the queue asynchronously.
 *
 * A 200 means CONNECTED. The client maps the error codes to its connection state.
 */
export const refreshInstagram: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const { accessToken, instagramUid } =
      await getDecryptedInstagramTokenForCustomer(customerId);

    await checkUserInstagramPermission(accessToken, instagramUid);

    // --- Refresh profile/basic account data ---
    const customerDataFromIg = await getUserDataFromIG(accessToken);
    if (!customerDataFromIg) {
      throw createCustomError(
        2005,
        "Failed to fetch user data from Instagram",
        502
      );
    }

    // Snapshot the prior follower count: this endpoint is re-probed on every app
    // foreground, so we only bust the reward-estimate cache when a pricing input
    // (follower count) genuinely changed — never just because the app reopened.
    const prevAccount = await prisma.customerInstagramAccount.findUnique({
      where: { customerId },
      select: { followerCount: true },
    });

    const updatedIgAccount = await prisma.customerInstagramAccount.update({
      where: { customerId },
      data: {
        followerCount: customerDataFromIg.followers_count,
        accountType: customerDataFromIg.account_type,
        name: customerDataFromIg.name,
        username: customerDataFromIg.username,
        pfpUrl: customerDataFromIg.profile_picture_url,
      },
      select: {
        id: true,
        username: true,
        name: true,
        pfpUrl: true,
        followerCount: true,
        accountType: true,
      },
    });

    // Opportunistic audience snapshot refresh (non-blocking for the client).
    const instagramId = updatedIgAccount.id;

    const latest = await prisma.instagramSnapshot.findFirst({
      where: { instagramId },
      orderBy: [{ snapshotTakenAt: "desc" }, { id: "desc" }],
      select: { snapshotTakenAt: true },
    });

    const alreadyHadSnapshot = latest !== null;

    const needsRefresh =
      !latest ||
      Date.now() - latest.snapshotTakenAt.getTime() >=
        REFRESH_INSTAGRAM_SNAPSHOT_INTERVAL;

    let snapshotQueued = false;
    if (needsRefresh) {
      const alreadyQueued = await prisma.instagramSnapshotQueue.findFirst({
        where: { instagramId, status: "SCHEDULED" },
        orderBy: { scheduledAt: "desc" },
        select: { scheduledAt: true },
      });

      if (!alreadyQueued) {
        snapshotQueued = true;
        await queueInstagramSnapshotJob({
          instagramId,
          scheduledAt: new Date(),
          tx: prisma,
        });
      }
    }

    const { id: _id, ...igProfile } = updatedIgAccount;

    // Only invalidate when the follower count actually moved — a no-op refresh on
    // app open must not reset the cache (see the prevAccount snapshot above).
    if (prevAccount?.followerCount !== updatedIgAccount.followerCount) {
      await bumpCustomerRewardEstGen(customerId);
    }

    res.status(200).json({
      // `hasSnapshot` is the same existence signal as `alreadyHadSnapshot` (a
      // snapshot row already exists for this account) — a freshly *queued*
      // snapshot does not flip it true; only the worker writing one does.
      instagram: { ...igProfile, hasSnapshot: alreadyHadSnapshot },
      snapshotQueued,
      alreadyHadSnapshot,
    } satisfies RefreshInstagramResponse);
  }
);
