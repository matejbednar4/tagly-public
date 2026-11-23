import { Prisma } from "../../generated/prisma/client.js";
import {
  REFERRAL_DECAYED_BPS,
  REFERRAL_FULL_REWARD_DURATION_MS,
  REFERRAL_TAKES_BPS,
} from "../../constants/rewards/REFERRAL_TAKES.js";

/** The account owed a referral payout — exactly one owner kind. */
export type ReferrerPayee =
  | { type: "advertiser"; id: number }
  | { type: "customer"; id: number };

/**
 * Resolves the referrer owed a cut for a referred account, plus their effective
 * take in bps (base take × full-strength/decay multiplier).
 *
 * Pass **exactly one** of `advertiserId` / `customerId` — whichever referred
 * account you want the referrer of. Advertiser and customer both expose the same
 * `accountReferral` relation, so this is one function; only the table queried and
 * which `REFERRAL_TAKES_BPS` take applies differ (merged from the former
 * `findAdvertiserReferrer` + `findCustomerReferrer`, byte-identical otherwise).
 *
 * Returns `null` when the account has no referral event, or on a data-integrity
 * issue (the `referrerCode` has neither or both owner kinds set).
 */
export async function findReferrer(
  args: { tx: Prisma.TransactionClient } & (
    | { advertiserId: number; customerId?: never }
    | { customerId: number; advertiserId?: never }
  ),
): Promise<{
  referrerEventId: number;
  referrerBps: number;
  referrer: ReferrerPayee;
} | null> {
  const { tx } = args;
  const isAdvertiser = args.advertiserId !== undefined;

  // The event that referred THIS account + the referrerCode's owner. Kept inline
  // per branch (a shared select const widens `true`→`boolean` and breaks Prisma's
  // payload inference); identical shape for both models.
  const row = isAdvertiser
    ? await tx.advertiser.findUnique({
        where: { id: args.advertiserId },
        select: {
          accountReferral: {
            select: {
              referredEvent: {
                select: {
                  createdAt: true,
                  id: true,
                  referrerCode: {
                    select: {
                      advertiser: { select: { id: true } },
                      customer: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : await tx.customer.findUnique({
        where: { id: args.customerId },
        select: {
          accountReferral: {
            select: {
              referredEvent: {
                select: {
                  createdAt: true,
                  id: true,
                  referrerCode: {
                    select: {
                      advertiser: { select: { id: true } },
                      customer: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

  if (!row || !row.accountReferral.referredEvent) return null;

  const ev = row.accountReferral.referredEvent;
  const ageMs = new Date().getTime() - ev.createdAt.getTime();

  const baseBps = isAdvertiser
    ? REFERRAL_TAKES_BPS.ADVERTISER_REFERRER_TAKE_BPS
    : REFERRAL_TAKES_BPS.CUSTOMER_REFERRER_TAKE_BPS;

  // Full-strength until the boost window elapses, then decayed.
  const multiplierBps =
    ageMs > REFERRAL_FULL_REWARD_DURATION_MS ? REFERRAL_DECAYED_BPS : 10_000;
  const referrerBps = Math.round((baseBps * multiplierBps) / 10_000);

  // Resolve payee — exactly one owner must be set.
  const advOwnerId = ev.referrerCode.advertiser?.id ?? null;
  const custOwnerId = ev.referrerCode.customer?.id ?? null;

  let referrer: ReferrerPayee;
  if (advOwnerId && !custOwnerId) {
    referrer = { type: "advertiser", id: advOwnerId };
  } else if (custOwnerId && !advOwnerId) {
    referrer = { type: "customer", id: custOwnerId };
  } else {
    return null; // data integrity: neither or both owners set
  }

  return { referrerEventId: ev.id, referrerBps, referrer };
}
