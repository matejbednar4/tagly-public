import {
  Prisma,
  TransactionKind,
  TransactionLedgerEvent,
} from "../../../generated/prisma/client.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { asBigInt } from "../../formatting/asBigInt.js";
import { AnyNumber } from "./helpers/types.js";
import { applyBalancesFromEvent } from "./applyBalancesFromEvent.js";
import { maybeQueueAdvertiserBudgetNotificaions } from "./helpers/maybeQueueAdvertiserBudgetNotifications.js";
import { maybeQueueCustomerBalanceNotificaions } from "./helpers/maybeQueueCustomerBalanceNotifications.js";
import { validateCurrencyIsSupportedOrThrow } from "../../formatting/validateCurrencyIsSupportedOrThrow.js";

export type CreateLedgerEventInput = {
  kind: TransactionKind;
  currency: string;

  advertiserId?: number;
  customerId?: number;

  deltaAdvertiserCents?: AnyNumber;
  deltaAdvertiserLockedCents?: AnyNumber;
  deltaCustomerCents?: AnyNumber;
  deltaCustomerLockedCents?: AnyNumber;
  deltaPlatformCents?: AnyNumber;
  deltaPlatformLockedCents?: AnyNumber;

  grossSharePriceCents?: AnyNumber;
  shareId?: number;

  externalRef?: string;
  meta?: Prisma.InputJsonObject;
  createdAt?: Date;

  enforceZeroSum?: boolean;
  idempotentOnExternalRef?: boolean;
  stripeWithdrawalId?: number;
  stripeCreditPurchaseId?: number;
  notify?: boolean;
};

export async function createLedgerEvent(
  db: Prisma.TransactionClient,
  input: CreateLedgerEventInput
): Promise<TransactionLedgerEvent> {
  const {
    kind,
    currency: rawCurrency,

    advertiserId,
    customerId,

    deltaAdvertiserCents,
    deltaAdvertiserLockedCents,
    deltaCustomerCents,
    deltaCustomerLockedCents,
    deltaPlatformCents,
    deltaPlatformLockedCents,

    grossSharePriceCents,
    shareId,

    externalRef,
    meta,
    createdAt,

    enforceZeroSum = false,
    idempotentOnExternalRef = true,
    stripeWithdrawalId,
    stripeCreditPurchaseId,
    notify = true,
  } = input;

  const currency = validateCurrencyIsSupportedOrThrow(rawCurrency);

  const data: Prisma.TransactionLedgerEventCreateInput = {
    kind,
    currency,

    advertiser: advertiserId ? { connect: { id: advertiserId } } : undefined,
    deltaAdvertiserCents: asBigInt(deltaAdvertiserCents),
    deltaAdvertiserLockedCents: asBigInt(deltaAdvertiserLockedCents),

    customer: customerId ? { connect: { id: customerId } } : undefined,
    deltaCustomerCents: asBigInt(deltaCustomerCents),
    deltaCustomerLockedCents: asBigInt(deltaCustomerLockedCents),

    deltaPlatformCents: asBigInt(deltaPlatformCents),
    deltaPlatformLockedCents: asBigInt(deltaPlatformLockedCents),

    grossSharePriceCents: asBigInt(grossSharePriceCents),
    share: shareId ? { connect: { id: shareId } } : undefined,

    externalRef: externalRef ?? null,
    meta,
    createdAt,

    ...(stripeWithdrawalId && {
      stripeWithdrawal: { connect: { id: stripeWithdrawalId } },
    }),

    ...(stripeCreditPurchaseId && {
      stripeCreditPurchase: { connect: { id: stripeCreditPurchaseId } },
    }),
  };

  // at least one delta must be non-zero
  const nonZero =
    data.deltaAdvertiserCents !== 0n ||
    data.deltaAdvertiserLockedCents !== 0n ||
    data.deltaCustomerCents !== 0n ||
    data.deltaCustomerLockedCents !== 0n ||
    data.deltaPlatformCents !== 0n ||
    data.deltaPlatformLockedCents !== 0n;

  if (!nonZero) {
    throw createCustomError(1201, "no deltas", 400);
  }

  // participant presence when their delta is non-zero
  if (
    (data.deltaCustomerCents !== 0n || data.deltaCustomerLockedCents !== 0n) &&
    !customerId
  ) {
    throw createCustomError(1202, "customerId required", 400);
  }
  if (
    (data.deltaAdvertiserCents !== 0n ||
      data.deltaAdvertiserLockedCents !== 0n) &&
    !advertiserId
  ) {
    throw createCustomError(1203, "advertiserId required", 400);
  }

  // optional zero-sum check
  if (enforceZeroSum) {
    const sum =
      asBigInt(data.deltaAdvertiserCents) +
      asBigInt(data.deltaAdvertiserLockedCents) +
      asBigInt(data.deltaCustomerCents) +
      asBigInt(data.deltaCustomerLockedCents) +
      asBigInt(data.deltaPlatformCents) +
      asBigInt(data.deltaPlatformLockedCents);

    if (sum !== 0n) {
      // The ledger deltas don't balance — a core money-integrity invariant broke.
      // Always alert; the imbalance + ref ride to the tracker via `cause` (kept
      // out of the client-facing message).
      throw createCustomError(1206, "zero-sum violated", {
        status: 400,
        notify: true,
        notifyKey: `ledger-zero-sum:${externalRef ?? "no-ref"}`,
        cause: `zero-sum violated: sum=${sum.toString()} externalRef=${
          externalRef ?? "none"
        }`,
      });
    }
  }

  // idempotency on externalRef
  if (idempotentOnExternalRef && externalRef) {
    const existing = await db.transactionLedgerEvent.findUnique({
      where: { externalRef_kind: { externalRef, kind } },
    });
    if (existing) return existing;
  }

  let event: TransactionLedgerEvent;
  try {
    event = await db.transactionLedgerEvent.create({ data });
  } catch (err) {
    // Race on the (externalRef, kind) unique constraint: two concurrent
    // webhook replays both pass the pre-check above and both attempt create.
    // The loser hits P2002; re-read and return the winner's row instead of
    // leaking the raw Prisma error to the wrapper.
    if (
      idempotentOnExternalRef &&
      externalRef &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await db.transactionLedgerEvent.findUnique({
        where: { externalRef_kind: { externalRef, kind } },
      });
      if (existing) return existing;
    }
    throw err;
  }

  const { customer, advertiser } = await applyBalancesFromEvent(db, event);

  if (notify && advertiser) {
    await maybeQueueAdvertiserBudgetNotificaions({ advertiser, event });
  }

  if (notify && customer) {
    await maybeQueueCustomerBalanceNotificaions({ customer, event });
  }

  return event;
}
