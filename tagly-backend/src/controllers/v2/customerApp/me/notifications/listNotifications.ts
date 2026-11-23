import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import {
  NotificationChannel,
  AccountType,
} from "../../../../../generated/prisma/client.js";
import type {
  ListNotificationSettingsQuery,
  ListNotificationSettingsResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/me/notifications?channel=PUSH|EMAIL` — the customer's
 * configurable notifications for one channel, grouped by category with every
 * event resolved to its effective on/off + mandatory state. One fetch renders the
 * whole screen; the client localizes category/event copy from the `slug` via the
 * shared catalog, so no English text crosses the wire.
 *
 * Effective-on for a channel is `mandatory ∪ (available − disabled)` — opt-out
 * storage: a missing `NotificationEventOptOut` row means every available channel
 * is on, and mandatory channels are always on. Categories with no events on the
 * channel are omitted.
 */
export const listNotifications: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { channel } = req.validatedQuery as ListNotificationSettingsQuery;

    const categories = await prisma.notificationCategory.findMany({
      select: {
        slug: true,
        events: {
          where: {
            target: AccountType.CUSTOMER,
            status: "ACTIVE",
            OR: [
              { availableChannels: { has: channel } },
              { mandatoryChannels: { has: channel } },
            ],
          },
          select: {
            id: true,
            slug: true,
            availableChannels: true,
            mandatoryChannels: true,
            optOuts: {
              where: { customerId },
              select: { disabledChannels: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const result = categories
      .map((c) => ({
        slug: c.slug,
        events: c.events.map((e) => {
          const mandatory = new Set(e.mandatoryChannels ?? []);
          const available = new Set([
            ...(e.availableChannels ?? []),
            ...mandatory,
          ]);
          const disabled = new Set(e.optOuts[0]?.disabledChannels ?? []);

          // effective = mandatory ∪ (available − disabled)
          const effective = new Set<NotificationChannel>([
            ...mandatory,
            ...[...available].filter((ch) => !disabled.has(ch)),
          ]);

          return {
            id: e.id,
            slug: e.slug,
            enabled: effective.has(channel),
            mandatory: mandatory.has(channel),
          };
        }),
      }))
      .filter((c) => c.events.length > 0);

    res.status(200).json({
      channel,
      categories: result,
    } satisfies ListNotificationSettingsResponse);
  },
);
