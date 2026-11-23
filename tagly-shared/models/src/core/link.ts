import { z } from "zod";

/**
 * Moderation status of a business-supplied web link (website / menu /
 * reservation). Mirrors the backend `LinkStatus` enum. Only `APPROVED` links are
 * surfaced to customers; the owner (advertiser) sees every status on their own
 * page so they know what's still under review or was rejected.
 */
export const LinkStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type LinkStatus = z.infer<typeof LinkStatusSchema>;
