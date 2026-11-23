import { Prisma } from "../../../../generated/prisma/client.js";
import {
  AdvertiserEventSlug,
  CustomerEventSlug,
} from "../../../../constants/catalogs/notifications/notificationRegistry.js";

export type PendingAdvertiserNotification = {
  eventSlug: AdvertiserEventSlug;
  payload: Prisma.InputJsonObject;
  dedupeKey: string;
  advertiserIds: number[];
} | null;

export type PendingCustomerNotification = {
  eventSlug: CustomerEventSlug;
  payload: Prisma.InputJsonObject;
  dedupeKey: string;
  customerIds: number[];
} | null;

/**
 * Result of a payout.failed / payout.canceled handler. Carries the (best-effort)
 * customer notification plus the D4 signal that this failure exhausted the
 * withdrawal's automatic payout retries — the caller sends the ops alert *after*
 * the tx commits, keyed by `withdrawalUid`.
 */
export type ConnectPayoutResult = {
  note: PendingCustomerNotification;
  exhausted: boolean;
  withdrawalUid: string | null;
};
