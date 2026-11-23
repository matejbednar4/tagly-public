import { z } from "zod";
import {
  CreateBusinessInitBodySchema,
  CreateBusinessInitResponseSchema,
} from "../../advertiserApp/businesses/createBusinessInit";

/**
 * `POST /v2/admin/businesses/init` — phase 1 of an ADMIN creating a business
 * page. The created page is UNOWNED (`advertiserId: null` — the
 * subsidized-track shape); subsidizing it (opening a `SubsidizationPeriod`)
 * is a separate admin action, so a freshly created page is customer-visible
 * but not yet shareable.
 *
 * Deliberate wire-twin: the body/response ALIAS the advertiser schemas — both
 * endpoints run the same `createBusinessInitCore`, so the wires stay in
 * lockstep by construction (a field added to the advertiser create appears
 * here automatically). Admin ships in lockstep with the backend, so this
 * coupling is free (no back-compat constraints on the admin side).
 */
export const AdminCreateBusinessInitBodySchema = CreateBusinessInitBodySchema;
export type AdminCreateBusinessInitBody = z.infer<
  typeof AdminCreateBusinessInitBodySchema
>;

export const AdminCreateBusinessInitResponseSchema =
  CreateBusinessInitResponseSchema;
export type AdminCreateBusinessInitResponse = z.infer<
  typeof AdminCreateBusinessInitResponseSchema
>;
