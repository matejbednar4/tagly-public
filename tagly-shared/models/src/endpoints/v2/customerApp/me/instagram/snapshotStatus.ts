import { z } from "zod";

/**
 * `GET /v2/customers/me/instagram/snapshot-status` — lightweight poll the client
 * uses while waiting on an audience snapshot queued by `/me/instagram/refresh`.
 * `hasSnapshot` flips true once the IG snapshot worker has written one.
 */
export const GetInstagramSnapshotStatusResponseSchema = z.object({
  hasSnapshot: z.boolean(),
});
export type GetInstagramSnapshotStatusResponse = z.infer<
  typeof GetInstagramSnapshotStatusResponseSchema
>;
