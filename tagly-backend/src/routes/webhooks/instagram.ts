import express, { Router } from "express";
import { deauthorizeInstagramWebhook } from "../../controllers/webhooks/instagram/deauthorizeInstagram.js";
import { deleteInstagramDataWebhook } from "../../controllers/webhooks/instagram/deleteInstagramData.js";
import { getInstagramDeletionStatus } from "../../controllers/webhooks/instagram/deletionStatus.js";

const r = Router();

// Meta compliance callbacks post application/x-www-form-urlencoded signed_request bodies.
r.post(
  "/deauthorize",
  express.urlencoded({ extended: false }),
  deauthorizeInstagramWebhook,
);

r.post(
  "/delete-data",
  express.urlencoded({ extended: false }),
  deleteInstagramDataWebhook,
);

r.get(
  "/deletion-status",
  express.urlencoded({ extended: false }),
  getInstagramDeletionStatus,
);

export default r;
