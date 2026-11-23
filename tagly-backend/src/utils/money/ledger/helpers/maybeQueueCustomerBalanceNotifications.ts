import {
  Prisma,
  TransactionKind,
  TransactionLedgerEvent,
} from "../../../../generated/prisma/client.js";
import { queueNotificationJobs } from "../../../queue/queueNotificationJobs.js";
import prisma from "../../../../prisma/prisma.js";

export const maybeQueueCustomerBalanceNotificaions = async (input: {
  customer: {
    id: number;
    sensitiveData: {
      balanceUsdCents: bigint;
      lockedBalanceUsdCents: bigint;
    };
  };
  event: TransactionLedgerEvent;
}) => {
  const { customer, event } = input;

  if (event.deltaCustomerCents === 0n) {
    return;
  }

  if (event.kind === TransactionKind.SHARE_PAYMENT) {
    let shareUid: string | null = null;
    let localName: string | null = null;

    if (event.shareId) {
      const share = await prisma.share.findUnique({
        where: { id: event.shareId },
        select: { uid: true, local: { select: { name: true } } },
      });
      shareUid = share?.uid ?? null;
      localName = share?.local?.name ?? null;
    }

    // Amount formatted server-side as plain USD (no locale/rate machinery in
    // the backend — the wire currency is USD; the apps' CZK conversion is a
    // client-side courtesy that doesn't apply to push copy).
    const amountFormatted = `$${(Number(event.deltaCustomerCents) / 100).toFixed(2)}`;

    await queueNotificationJobs({
      customerIds: [customer.id],
      eventSlug: "c.balance.share-payout",
      payload: { shareUid, localName, amountFormatted },
      dedupeKey: `share-payout-cust-${customer.id}-${event.id}`,
    });
  }
};
