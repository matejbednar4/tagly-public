import { z } from "zod";
import { AdvertiserUidSchema } from "../../../../core/uids";
import { EmailSchema } from "../../../../core/email";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../core/locale";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema } from "../../../../core/money";
import { PaygStatusSchema } from "../billing/paygStatus";
import { MonthlyBudgetSummarySchema } from "../billing/monthlyBudgetStatus";

/**
 * The advertiser's spendable money state, embedded on `AdvertiserMe`. Drives the
 * home hero (visibility) and the home CTA: the "add budget" CTA shows only while
 * the account has no way to pay — `availableCents <= 0 && !paygActive` — and
 * flips to "rate shares" once funded. Cents are `bigint` on the hydrator input,
 * coerced to number on the wire.
 */
export const AdvertiserBudgetsSchema = z.object({
  /** Prepaid credit balance available to lock against new shares. */
  availableCents: CentsSchema,
  /** Credit already reserved for in-flight (PROCESSING) shares. */
  lockedCents: CentsSchema,
  /**
   * Lifetime GROSS credits purchased — derived from the ledger (sum of
   * CREDIT_PURCHASE events only; PAYG charges, refunds, dispute clawbacks and
   * deletion forfeits are excluded), so it is not a net or current figure and
   * must not be rendered as one. Rendered by the advertiser app's account tab
   * as the "Credits purchased" stat
   * (`tagly-advertiser/app/(app)/(tabs)/account/index.tsx` → `StatsDisplay`),
   * whose label is honest about being gross. Nothing gates on it (the sibling
   * `funded` boolean is derived separately).
   */
  totalCreditPurchasesCents: CentsSchema,
  /** Whether an open PAYG period + card on file is active (pay-as-you-go). */
  paygActive: z.boolean(),
  /**
   * Server-derived PAYG state (see `PaygStatusSchema`) — clients render from
   * this instead of re-deriving the card/period rules. PAYG has no spend cap.
   */
  paygStatus: PaygStatusSchema,
  /**
   * The monthly-budget slice (status + target + next charge) for the Home /
   * Wallet cards. Added with the monthly-budget feature (2026-08-31); shipped
   * builds that predate it ignore the key.
   */
  monthlyBudget: MonthlyBudgetSummarySchema,
});
export type AdvertiserBudgetsInput = z.input<typeof AdvertiserBudgetsSchema>;
export type AdvertiserBudgets = z.infer<typeof AdvertiserBudgetsSchema>;

/**
 * `AdvertiserMe` — the lean core of the logged-in advertiser, returned by
 * `GET /v2/advertisers/me`. Deliberately minimal for now (the v2 advertiser
 * rewrite builds its Me surface incrementally); bulkier slices (balance,
 * business pages, PAYG state) land as their own fields/sub-resources when the
 * screens that need them are built. Additions are wire-safe; keep it lean.
 */
export const AdvertiserMeSchema = z.object({
  uid: AdvertiserUidSchema,
  email: EmailSchema,
  /** ISO alpha-2 country code (`US`, `CZ`). Drives EU-only UX gates (PAYG consent checkbox). */
  locale: SupportedLocaleSchema,
  /** ISO 639-1 language code (`en`, `cs`). */
  language: SupportedLanguageSchema,
  /**
   * Any funding signal: an open PAYG period, a positive available balance, or
   * any past credit purchase. Drives the setup gate: the payment step shows
   * while unfunded (unless dismissed on this device — the "skipped" fact is a
   * device-local flag, not server state), and never re-asks a funded account
   * (crash recovery after a successful PaymentSheet, migrated v1 accounts).
   */
  funded: z.boolean(),
  /**
   * Whether the advertiser has at least one business page (local subaccount).
   * Same role as `funded` for the business-page setup step.
   */
  hasBusinessPage: z.boolean(),
  /**
   * Whether the advertiser is CURRENTLY visible to customers — at least one
   * business page meets the accessibility rule (enough available credit, an
   * active PAYG period, or an in-allowance subsidization). Distinct from
   * the sticky `funded`: an account that activated once but whose credits ran
   * out (or whose PAYG card is failing) is `funded` but not `visible`. Drives
   * the home CTA split — `!funded` = never activated ("nobody can see you");
   * `funded && !visible` = lapsed ("top up credits or fix PAYG").
   */
  visible: z.boolean(),
  /**
   * Spendable money state (available/locked credit, PAYG). Drives the home
   * hero + the conditional add-budget CTA. Additive since the lean launch of
   * this DTO — old clients ignore it.
   */
  budgets: AdvertiserBudgetsSchema,
  /**
   * Marketing opt-in flag (one flag gates both promo email + push). Drives the
   * "Promotions and reminders" toggle on the notification settings screen.
   * Additive since the lean launch of this DTO — old clients ignore it.
   */
  promoNotificationsEnabled: z.boolean(),
  /**
   * True when the Terms of Service have been updated since this advertiser last
   * agreed — drives the blocking app-open re-acceptance modal (twin of the
   * customer flag). Cleared by `POST /v2/cross/terms-of-service/agree`.
   * Additive since the lean launch of this DTO — old clients ignore it.
   */
  shouldAgreeWithLatestTos: z.boolean(),
  /** As `shouldAgreeWithLatestTos`, for the Privacy Policy. */
  shouldAgreeWithLatestPrivacyPolicy: z.boolean(),
  createdAt: ISODateSchema,
});
export type AdvertiserMeInput = z.input<typeof AdvertiserMeSchema>;
export type AdvertiserMe = z.infer<typeof AdvertiserMeSchema>;
