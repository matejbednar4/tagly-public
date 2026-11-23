import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { ShareVoidReasonSchema } from "../../../../core/enums";
import { ShareInsightsSchema, type ShareInsights } from "../../../../core/shareInsights";
import { BusinessPublicPreviewSchema } from "../businesses/businessPublicPreview";
import { CustomerSharePreviewSchema } from "./customerSharePreview";

/** @see ShareInsightsSchema — the canonical story-performance shape (core/). Kept
 *  as customer-named aliases so existing imports don't churn. */
export const CustomerShareInsightsSchema = ShareInsightsSchema;
export type CustomerShareInsights = ShareInsights;

/**
 * A customer's own share, full detail view — the `CustomerSharePreview` plus the
 * extra fields a detail page shows. Fetched by uid
 * (`GET /v2/customers/shares/:uid`).
 *
 * Inherits the preview's derived `status`, reward (estimate → final), reach, media,
 * rating, and the lean `local` ({ name }); the detail adds `business` (the full
 * public preview, so it can render a BusinessPreview card) plus the "why / when /
 * how it performed" fields below. All additions are nullable and degrade
 * gracefully — the hydrator never throws.
 *
 * Note: there is no raw `report` field — the report outcome is folded into the
 * derived `status` (a VALID report ⇒ REJECTED), and the advertiser's report message
 * is deliberately not surfaced. A report-upheld rejection is therefore detectable
 * as `status === "REJECTED"` with a null `rejectionReason` (an intake reject always
 * carries an admin reason). The customer never needs the structured report.
 */
export const CustomerShareDetailsSchema = CustomerSharePreviewSchema.extend({
  /** The business this share promoted — the canonical public preview (name,
   *  banner, type, reward estimate, …) so the detail can render a BusinessPreview
   *  card. Null when it can't be resolved (e.g. an address without coordinates). */
  business: BusinessPublicPreviewSchema.nullable(),
  /** The admin's intake-reject reason, when the share was rejected at review. Null
   *  for a report-upheld rejection (its reason is the advertiser's report, which we
   *  don't surface) and for any non-REJECTED share — so the screen reads REJECTED +
   *  a null reason as "rejected by report". */
  rejectionReason: z.string().nullable(),
  /** Why the share was voided, when `status` is UNPAYABLE — a slug the screen
   *  maps to localized copy (IG_DISCONNECTED / IG_DATA_DELETED / ACCOUNT_DELETED /
   *  INSIGHTS_UNAVAILABLE / SETTLEMENT_FAILED). Null on non-UNPAYABLE shares and
   *  on shares voided before the column existed (→ generic fallback copy). */
  voidReason: ShareVoidReasonSchema.nullable(),
  /** When the reward was paid out. Null until the share is PAID. */
  paidAt: ISODateSchema.nullable(),
  /** The story's Instagram performance. Null until the insights worker captures it. */
  insights: CustomerShareInsightsSchema.nullable(),
});

export type CustomerShareDetails = z.infer<typeof CustomerShareDetailsSchema>;
export type CustomerShareDetailsInput = z.input<
  typeof CustomerShareDetailsSchema
>;
