import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { customerHasSnapshot } from "../../../../../utils/instagram/snapshots/customerHasSnapshot.js";
import type { GetInstagramSnapshotStatusResponse } from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/me/instagram/snapshot-status` — returns whether the
 * logged-in customer has an Instagram audience snapshot yet. The client polls
 * this while waiting on a snapshot queued by `/me/instagram/refresh`. Uses the
 * shared `customerHasSnapshot` definition so this poll clears at the same instant
 * `CustomerMe.instagram.hasSnapshot` and the reward estimates flip.
 */
export const getInstagramSnapshotStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    res.status(200).json({
      hasSnapshot: await customerHasSnapshot(customerId),
    } satisfies GetInstagramSnapshotStatusResponse);
  }
);
