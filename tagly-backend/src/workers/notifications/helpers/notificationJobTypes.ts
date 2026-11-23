import type {
  AccountType,
  NotificationChannel,
  Prisma,
} from "../../../generated/prisma/client.js";

/** Hydrated notification job — the `select` claimed by the notifications worker. */
export type NotificationJob = {
  id: number;
  attempts: number;
  scheduledAt: Date;
  /** Queue-row creation time — the promo log's occurrence bound (`since`). */
  createdAt: Date;
  target: AccountType;
  recipientId: number;
  eventSlug: string;
  channel: NotificationChannel;
  payload: Prisma.JsonValue | null;
  overwriteEmail: string | null;
};
