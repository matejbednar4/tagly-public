import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  ListNotificationSettingsQuerySchema,
  UpdateNotificationPreferencesBodySchema,
} from "@tagly/models/v2/advertiserApp";
import { listNotifications } from "../../../../../controllers/v2/advertiserApp/me/notifications/listNotifications.js";
import { updateNotificationPreferences } from "../../../../../controllers/v2/advertiserApp/me/notifications/updateNotificationPreferences.js";

/**
 * `/v2/advertisers/me/notifications/**` — the advertiser's per-channel
 * notification preferences (the settings screens).
 *   - `GET  /`             categories + events for a channel (PUSH | EMAIL)
 *   - `POST /preferences`  toggle one or more events on a channel (instant-persist)
 */
const r = Router();

r.get(
  "/",
  validateReq("query", ListNotificationSettingsQuerySchema),
  listNotifications,
);
r.post(
  "/preferences",
  validateReq("body", UpdateNotificationPreferencesBodySchema),
  updateNotificationPreferences,
);

export default r;
