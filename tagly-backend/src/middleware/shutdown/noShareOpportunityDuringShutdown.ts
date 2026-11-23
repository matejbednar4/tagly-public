import type { RequestHandler } from "express";
import type { GetShareOpportunityResponse } from "@tagly/models/v2/customerApp";
import { envVariables } from "../../environment/envVariables.js";

/**
 * @shutdown — short-circuits `GET /v2/customers/me/share-opportunity` (2026-10
 * wind-down). **Production only** — on staging/dev it calls `next()`, so the
 * real nudge still runs there.
 *
 * The app-open nudge would invite a share that `/shares/create` now rejects, so
 * always answer "nothing to nudge" — a valid response (no alert), and it skips
 * the IG fetch + Rekognition pass. Remove from the route to restore the nudge.
 */
export const noShareOpportunityDuringShutdown: RequestHandler = (
  _req,
  res,
  next,
) => {
  if (envVariables.APP_STAGE !== "production") return next();
  res
    .status(200)
    .json({ scenario: "none" } satisfies GetShareOpportunityResponse);
};
