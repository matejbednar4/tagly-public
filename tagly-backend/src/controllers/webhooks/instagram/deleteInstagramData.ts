import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../environment/envVariables.js";
import { parseInstagramSignedRequest } from "../../../utils/instagram/webhooks/parseInstagramSignedRequest.js";
import { deleteS3KeysOrThrow } from "../../../utils/aws/s3/deleteS3KeysOrThrow.js";
import { deleteCustomerInstagramData } from "../../../utils/instagram/deleteCustomerInstagramData.js";

// This is the User Data Deletion Callback URL
export const deleteInstagramDataWebhook: RequestHandler = asyncHandler(
  async (req, res) => {
    const body = req.body as { signed_request?: string };
    const signedRequest = body.signed_request;

    if (!signedRequest || typeof signedRequest !== "string") {
      throw createCustomError(4104, "Missing signed_request", 400);
    }

    const payload = parseInstagramSignedRequest(
      signedRequest,
      envVariables.IG_CLIENT_SECRET
    );

    if (!payload.user_id) {
      throw createCustomError(4105, "Missing user_id in payload", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { instagram: { instagramUid: payload.user_id } },
      select: { id: true },
    });

    if (!customer) {
      return res.status(204).send();
    }

    // Must run in a transaction: deleteCustomerInstagramData voids in-flight
    // shares (PROCESSING → UNPAYABLE) and releases their budget locks, and those
    // two writes have to commit together. With the base client each is a
    // separate auto-commit, so a crash between the flip and the unlock would
    // strand the lock (the retry sees UNPAYABLE and never releases it).
    const s3KeysToDelete = await prisma.$transaction((tx) =>
      deleteCustomerInstagramData(customer.id, tx)
    );

    await deleteS3KeysOrThrow(s3KeysToDelete).catch(() => {});

    // Meta expects JSON with url + confirmation_code
    const confirmationCode = `tagly_del_${payload.user_id}_${Date.now()}`;
    const statusUrl = `${envVariables.API_BASE_URL}/webhooks/instagram/deletion-status?confirmation_code=${confirmationCode}`;

    return res.status(200).json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  }
);
