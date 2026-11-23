import { createCustomError } from "../../core/errors/createCustomError.js";
import type { Prisma } from "../../../generated/prisma/client.js";

/**
 * Who is performing a business-page write. The create/update cores in this
 * folder are shared between the advertiser endpoints (`/v2/advertisers/me/
 * businesses/**`) and the admin endpoints (`/v2/admin/businesses/**`); the
 * actor is the ONLY thing that differs between the two surfaces:
 *
 * - `advertiser` — ownership is the IDOR filter (`advertiserId` in every
 *   lookup/claim), only ACTIVE pages are editable, and the advertiser-locale ↔
 *   business-country invariant is enforced on create + address change.
 * - `admin` — no ownership filter (role gating in the router is the
 *   authorization); may edit owned AND unowned pages, ACTIVE or BANNED (only
 *   DELETED is off-limits — its media may already be purged); creates unowned
 *   pages (`advertiserId: null` — the origin/main safety guard: an admin
 *   confirm can never claim an advertiser's pending row); the locale invariant
 *   applies only when the edited page HAS an advertiser (an unowned/subsidized
 *   page may be moved between countries freely — the long-standing semantics).
 */
export type BusinessWriteActor =
  | { kind: "advertiser"; advertiserId: number }
  | { kind: "admin" };

/**
 * The pending-row owner the create claim/refetch must match. `null` for admin
 * — Prisma matches `advertiserId: null` only against unowned pending rows, so
 * neither surface can ever claim the other's half-done creation.
 */
export function pendingBusinessOwnerId(actor: BusinessWriteActor): number | null {
  return actor.kind === "advertiser" ? actor.advertiserId : null;
}

/** The lookup scope for edits of a LIVE business (see the actor docs above). */
export function businessWriteScopeWhere(
  actor: BusinessWriteActor,
  uid: string,
): Prisma.LocalSubaccountWhereInput {
  return actor.kind === "advertiser"
    ? { uid, advertiserId: actor.advertiserId, status: "ACTIVE" }
    : { uid, status: { not: "DELETED" } };
}

/**
 * Business-not-found stays per-surface: 4604 is the advertiser wire's code,
 * 4043 the admin wire's (matches `GET /v2/admin/businesses/:uid`).
 */
export function businessNotFoundError(actor: BusinessWriteActor) {
  return actor.kind === "advertiser"
    ? createCustomError(4604, "Business not found", 404)
    : createCustomError(4043, "Business not found", 404);
}
