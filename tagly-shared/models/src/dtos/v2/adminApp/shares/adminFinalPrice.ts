import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema } from "../../../../core/money";

/**
 * The stored `FinalPrice` row for a settled share — the full pricing audit the
 * algorithm produced: the reach→base→bonuses build-up, every multiplier (in
 * bps), the cap audit, and the settlement-vs-algo outcome. Null until the share
 * settles. This is the real persisted row, not a derivation from constants.
 *
 * Reconstruction (see the schema docblock): finalPriceCents = subtotalAfterCap ×
 * (subsidized ? 1 − platformTake : 1) × countryMultiplier. `settledGrossCents` /
 * `capReason` explain when the gross actually collected fell short of the algo
 * price (LOW_BUDGET / OVER_LOCK / PLATFORM_BALANCE); null capReason = paid in full.
 */
export const AdminFinalPriceSchema = z.object({
  /** Release that priced this row (e.g. "2.0.2"); pre-v12 rows hold the old counter as text. */
  algoVersion: z.string(),
  currency: z.string(),

  qualifiedReach: z.number(),
  ecpmCents: CentsSchema,
  baseValueCents: CentsSchema,
  actionBonusesCents: CentsSchema,

  geoMultiplierBps: z.number(),
  demoMultiplierBps: z.number(),
  interestMultiplierBps: z.number(),
  /** Business-type multiplier (type catalog override else primary vertical, e.g. the cafe discount) — wired at algo v11 (null on earlier rows, which priced it as 1.0x). */
  typeMultiplierBps: z.number().nullable(),
  ratingMultiplierBps: z.number(),
  frequencyMultiplierBps: z.number(),
  audienceRelevanceMultiplierBps: z.number(),
  /** Follower:following ratio penalty (null on rows settled by pricers before algo v7). */
  accountQualityMultiplierBps: z.number().nullable(),

  subtotalBeforeCapCents: CentsSchema.nullable(),
  subtotalAfterCapCents: CentsSchema.nullable(),
  countryMultiplierBps: z.number().nullable(),

  finalPriceCents: CentsSchema,

  /** Gross actually collected at settlement (null until settled / on older rows). */
  settledGrossCents: CentsSchema.nullable(),
  /** Why the gross fell short: LOW_BUDGET / OVER_LOCK / PLATFORM_BALANCE; null = paid in full. */
  capReason: z.string().nullable(),

  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});
export type AdminFinalPrice = z.infer<typeof AdminFinalPriceSchema>;
export type AdminFinalPriceInput = z.input<typeof AdminFinalPriceSchema>;
