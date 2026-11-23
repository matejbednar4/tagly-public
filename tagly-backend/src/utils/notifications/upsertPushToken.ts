import { Prisma } from "../../generated/prisma/client.js";
import prisma from "../../prisma/prisma.js";

/**
 * Which account a device's push token belongs to. A token has EXACTLY ONE owner
 * — `PushToken` carries `customerId` / `advertiserId` / `pendingCustomerId`, and
 * the single-key union enforces that exactly one is supplied.
 */
export type PushTokenOwner =
  | { customerId: number }
  | { advertiserId: number }
  | { pendingCustomerId: number }
  | { pendingAdvertiserId: number };

/** Functional device metadata stored alongside the token (all optional). */
export type PushTokenMeta = {
  platform?: string;
  deviceId?: string;
  timezone?: string;
};

/**
 * Upserts a device's Expo push token and binds it to EXACTLY ONE owner: the
 * chosen owner FK is set, every other owner FK is nulled.
 *
 * Nulling the other FKs is the load-bearing part — a single device token must
 * never belong to two accounts, or one account's push notifications would leak
 * to another (e.g. a device that switched from an advertiser to a customer
 * login while keeping its stale `advertiserId`). Centralizing it here means the
 * "clear the others" set can't be forgotten at a call site.
 *
 * `disabledAt` is cleared on every upsert (re-enabling a previously disabled
 * token), and `lastSeenAt` is stamped — every upsert is an app-open-shaped
 * moment, so `lastSeenAt` doubles as the account's "last active on this device"
 * signal (the promo escalation email checks it to skip recipients who came back
 * after the push). Metadata is undefined-safe: fields omitted from `meta` are
 * left untouched on update.
 */
export async function upsertPushToken(
  token: string,
  owner: PushTokenOwner,
  meta: PushTokenMeta = {},
  tx: Prisma.TransactionClient = prisma
) {
  // Default every owner FK to null, then spread in the one provided — this sets
  // the chosen owner and nulls the others in a single expression.
  const ownerColumns = {
    customerId: null,
    advertiserId: null,
    pendingCustomerId: null,
    pendingAdvertiserId: null,
    ...owner,
  };
  const now = new Date();

  await tx.pushToken.upsert({
    where: { token },
    create: { token, ...ownerColumns, lastSeenAt: now, ...meta },
    update: { ...ownerColumns, disabledAt: null, lastSeenAt: now, ...meta },
  });
}
