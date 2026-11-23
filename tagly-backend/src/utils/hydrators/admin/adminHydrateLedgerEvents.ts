import type { AdminLedgerEventInput } from "@tagly/models/v2/adminApp";
import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";

/**
 * Hydrates transaction-ledger events into `AdminLedgerEvent`s, preserving the
 * order of the passed ids. The ledger is the money source of truth, so this
 * feeds every admin money trail (share / withdrawal / credit-purchase / feed).
 */
export default async function adminHydrateLedgerEvents(opts: {
  ledgerEventIds: number[];
}): Promise<AdminLedgerEventInput[]> {
  if (!opts.ledgerEventIds?.length) return [];

  const events = await prisma.transactionLedgerEvent.findMany({
    where: { id: { in: opts.ledgerEventIds } },
    select: {
      id: true,
      kind: true,
      currency: true,
      deltaAdvertiserCents: true,
      deltaAdvertiserLockedCents: true,
      deltaCustomerCents: true,
      deltaCustomerLockedCents: true,
      deltaPlatformCents: true,
      deltaPlatformLockedCents: true,
      share: { select: { uid: true } },
      meta: true,
      createdAt: true,
    },
  });

  if (events.length === 0) return [];

  const byId = new Map(events.map((e) => [e.id, e]));

  return opts.ledgerEventIds.map<AdminLedgerEventInput>((id) => {
    const e = byId.get(id);
    if (!e) {
      throw createCustomError(4462, `No event found for id ${id}`, 404);
    }
    const { id: _id, share, meta, ...rest } = e;
    return {
      ...rest,
      shareUid: share?.uid ?? null,
      meta: (meta as Record<string, unknown>) ?? null,
    };
  });
}
