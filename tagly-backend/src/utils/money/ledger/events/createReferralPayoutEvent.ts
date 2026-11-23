import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../generated/prisma/client.js";
import { createCustomError } from "../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../formatting/asBigInt.js";
import { createLedgerEvent } from "../createLedgerEvent.js";
import type { AnyNumber } from "../helpers/types.js";

// Tell it who to pay by providing exactly one of advertiserId OR customerId.
// externalRef must be unique per REFERRAL_PAYOUT (e.g., `share:${shareId}:ref:adv:v1`)
//
// Currency is supplied by the caller — a referral payout only ever happens inside
// a share settlement, which has already authoritatively resolved the share's
// currency (from its SHARE_LOCK event, or the explicit override for lock-less
// PAYG shares). This function must NOT re-derive it: PAYG shares have no
// SHARE_LOCK, so a self-query would wrongly fail for them.
export async function createReferralPayoutEvent(
  tx: Prisma.TransactionClient,
  input: {
    shareId: number;
    amountCents: AnyNumber; // > 0
    currency: string; // resolved by the calling share settlement
    advertiserId?: number; // pay advertiser if set
    customerId?: number; // pay customer if set
    externalRef: string;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const { shareId, currency, advertiserId, customerId, externalRef, meta } =
    input;

  const amount = asBigInt(input.amountCents);

  // validate
  if (!shareId || shareId <= 0) {
    throw createCustomError(1701, "shareId required", 400);
  }

  const paysAdvertiser = !!advertiserId && !customerId;
  const paysCustomer = !!customerId && !advertiserId;

  if (!paysAdvertiser && !paysCustomer) {
    throw createCustomError(
      1702,
      "provide exactly one of advertiserId or customerId",
      400
    );
  }

  if (amount <= 0n) {
    throw createCustomError(1703, "amount must be > 0", 400);
  }

  if (!externalRef || externalRef.trim().length === 0) {
    throw createCustomError(1705, "externalRef required for idempotency", 400);
  }

  if (!currency || currency.trim().length === 0) {
    throw createCustomError(1708, "currency required for referral payout", 400);
  }

  // idempotency on (externalRef, kind)
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.REFERRAL_PAYOUT },
    },
  });
  if (existing) {
    return { event: existing, created: false };
  }

  // Build deltas: +payee, -platform. No gross here.
  const base = {
    kind: TransactionKind.REFERRAL_PAYOUT,
    currency,
    shareId,
    externalRef,
    meta,
    enforceZeroSum: true,
    idempotentOnExternalRef: false, // handled manually above
  } as const;

  let event: TransactionLedgerEvent;

  try {
    if (paysAdvertiser) {
      if (!advertiserId || advertiserId <= 0) {
        throw createCustomError(1706, "advertiserId invalid", 400);
      }

      event = await createLedgerEvent(tx, {
        ...base,
        advertiserId,
        // credit advertiser, reduce platform revenue
        deltaAdvertiserCents: amount,
        deltaPlatformCents: -amount,
      });
    } else {
      if (!customerId || customerId <= 0) {
        throw createCustomError(1707, "customerId invalid", 400);
      }

      event = await createLedgerEvent(tx, {
        ...base,
        customerId,
        // credit customer, reduce platform revenue
        deltaCustomerCents: amount,
        deltaPlatformCents: -amount,
      });
    }
  } catch (err: any) {
    // race on unique(externalRef, kind)
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.REFERRAL_PAYOUT,
          },
        },
      });
      if (again) {
        return { event: again, created: false };
      }
    }
    throw err;
  }

  return { event, created: true };
}
