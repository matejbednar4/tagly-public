import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../environment/envVariables.js";
import { parseInstagramSignedRequest } from "../../../utils/instagram/webhooks/parseInstagramSignedRequest.js";

// This is the Deauthorize Callback URL
export const deauthorizeInstagramWebhook: RequestHandler = asyncHandler(
  async (req, res) => {
    const body = req.body as { signed_request?: string };
    const signedRequest = body.signed_request;

    if (!signedRequest || typeof signedRequest !== "string") {
      throw createCustomError(4102, "Missing signed_request", 400);
    }

    const payload = parseInstagramSignedRequest(
      signedRequest,
      envVariables.IG_CLIENT_SECRET
    );

    if (!payload.user_id) {
      throw createCustomError(4103, "Missing user_id in payload", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { instagram: { instagramUid: payload.user_id } },
      select: { id: true },
    });

    if (!customer) {
      return res.status(204).send();
    }

    await prisma.instagramToken.deleteMany({
      where: { instagram: { customerId: customer.id } },
    });

    return res.status(204).send();
  }
);
