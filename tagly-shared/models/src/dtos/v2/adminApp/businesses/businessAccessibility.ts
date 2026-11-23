import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { SubaccountStatusSchema } from "../../../../core/enums";

/**
 * Why a business IS accessible — the single funding path that grants visibility.
 * The accessibility rule grants access if ANY of credits / subsidized-with-
 * allowance / PAYG is satisfied; this names the one that did (display picks
 * credits → subsidized → PAYG when several hold). Null when not accessible.
 */
export const BusinessAccessGrantSchema = z.enum(["CREDITS", "SUBSIDIZED", "PAYG"]);
export type BusinessAccessGrant = z.infer<typeof BusinessAccessGrantSchema>;

/**
 * Why a business is NOT accessible. `NOT_ACTIVE` / `NEGATIVE_BALANCE` are the
 * absolute gates; the three funding failures are listed only when the business
 * is active + solvent but satisfies none of the funding paths.
 */
export const BusinessBlockedReasonSchema = z.enum([
  "NOT_ACTIVE", // status != ACTIVE (BANNED / DELETED)
  "NEGATIVE_BALANCE", // unpaid PAYG debt — hides even with an open PAYG period
  "INSUFFICIENT_CREDITS", // available < MIN_VISIBILITY_BUDGET_CENTS
  "SUBSIDIZATION_EXHAUSTED", // open subsidization period but share allowance used up
  "NOT_SUBSIDIZED", // no open subsidization period
  "NO_ACTIVE_PAYG", // no open PaygPeriod
]);
export type BusinessBlockedReason = z.infer<typeof BusinessBlockedReasonSchema>;

/**
 * The raw inputs the accessibility rule reads, so admin sees the math behind the
 * verdict (e.g. "available $3 < the $15 minimum").
 */
export const BusinessAccessibilityFactsSchema = z.object({
  status: SubaccountStatusSchema,
  /** The owning advertiser's available budget; 0 for a subsidized / unowned business. */
  availableBudgetCents: CentsSchema,
  /** MIN_VISIBILITY_BUDGET_CENTS — the credits threshold access is compared against. */
  minVisibilityBudgetCents: z.number(),
  hasOpenSubsidizationPeriod: z.boolean(),
  subsidizedShareCount: z.number(),
  /** SUBSIDIZATION.SHARE_LIMIT — the subsidized-share allowance. */
  subsidizationShareLimit: z.number(),
  hasActivePaygPeriod: z.boolean(),
});
export type BusinessAccessibilityFacts = z.infer<
  typeof BusinessAccessibilityFactsSchema
>;

/**
 * The structured verdict of `evaluateBusinessAccessibility`
 * (`tagly-backend/src/utils/businesses/businessAccessibility.ts`) — the same
 * rule as `businessAccessibleSql`, exposed as data instead of a bare boolean so
 * admin sees whether customers can see a business and exactly why / why not.
 * `visible == shareable` (the collapsed v2 rule).
 */
export const BusinessAccessibilitySchema = z.object({
  isAccessible: z.boolean(),
  grantedBy: BusinessAccessGrantSchema.nullable(),
  blockedReasons: z.array(BusinessBlockedReasonSchema),
  facts: BusinessAccessibilityFactsSchema,
});
export type BusinessAccessibility = z.infer<typeof BusinessAccessibilitySchema>;
export type BusinessAccessibilityInput = z.input<
  typeof BusinessAccessibilitySchema
>;
