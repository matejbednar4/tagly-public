import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import {
  Prisma,
  NotificationChannel,
  AccountType,
} from "../../../../../generated/prisma/client.js";
import type {
  SettingsNotificationChannel,
  UpdateNotificationPreferencesBody,
  UpdateNotificationPreferencesResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/notifications/preferences` — set the on/off state of
 * one or more events on a channel. The client sends a single update per toggle
 * (instant-persist), but the body accepts a batch, applied atomically.
 *
 * Storage is opt-OUT (`NotificationEventOptOut`): turning a channel off adds it
 * to the event's `disabledChannels` row; turning it back on removes it, and a
 * row whose set empties is deleted (back to the default all-on state, which is
 * "no row"). A mandatory channel can never be turned off (rejected, not thrown,
 * so a batch with one bad item still applies the rest). Duplicate
 * `(eventId, channel)` pairs coalesce last-write-wins. No-op toggles (already
 * in the desired state) are skipped.
 */
export const updateNotificationPreferences: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { updates } = req.validatedBody as UpdateNotificationPreferencesBody;

    // Coalesce duplicate (eventId, channel): last write wins.
    const keyed = new Map<
      string,
      { eventId: number; channel: SettingsNotificationChannel; enabled: boolean }
    >();
    for (const u of updates) {
      keyed.set(`${u.eventId}|${u.channel}`, {
        eventId: u.eventId,
        channel: u.channel,
        enabled: u.enabled,
      });
    }
    const valid = Array.from(keyed.values());

    // Load referenced events (advertiser-targeted, active) + existing prefs.
    const eventIds = [...new Set(valid.map((u) => u.eventId))];
    const events = await prisma.notificationEvent.findMany({
      where: {
        id: { in: eventIds },
        target: AccountType.ADVERTISER,
        status: "ACTIVE",
      },
      select: { id: true, mandatoryChannels: true, availableChannels: true },
    });
    const eventById = new Map(events.map((e) => [e.id, e]));

    const existing = await prisma.notificationEventOptOut.findMany({
      where: { advertiserId, eventId: { in: eventIds } },
      select: { eventId: true, disabledChannels: true },
    });
    const disabledByEventId = new Map(
      existing.map((o) => [o.eventId, o.disabledChannels ?? []]),
    );

    const rejected: UpdateNotificationPreferencesResponse["rejected"] = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const { eventId, channel, enabled } of valid) {
      const ev = eventById.get(eventId);
      if (!ev) {
        rejected.push({ eventId, channel, reason: "event not found" });
        continue;
      }

      const mandatory = new Set(ev.mandatoryChannels ?? []);
      const available = new Set([
        ...(ev.availableChannels ?? []),
        ...mandatory,
      ]);

      if (!available.has(channel)) {
        rejected.push({ eventId, channel, reason: "channel not available" });
        continue;
      }
      // Mandatory channels can never be turned off.
      if (!enabled && mandatory.has(channel)) {
        rejected.push({ eventId, channel, reason: "channel is mandatory" });
        continue;
      }

      const disabled = new Set<NotificationChannel>(
        (disabledByEventId.get(eventId) ?? []) as NotificationChannel[],
      );

      if (enabled) {
        // Turning ON = removing the opt-out for this channel.
        if (!disabled.has(channel)) continue; // no-op (already on)
        disabled.delete(channel);
        const next = Array.from(disabled);
        if (next.length === 0) {
          // Nothing disabled anymore — the default state is "no row".
          ops.push(
            prisma.notificationEventOptOut.delete({
              where: { advertiserId_eventId: { advertiserId, eventId } },
            }),
          );
          disabledByEventId.delete(eventId);
        } else {
          ops.push(
            prisma.notificationEventOptOut.update({
              where: { advertiserId_eventId: { advertiserId, eventId } },
              data: { disabledChannels: { set: next } },
            }),
          );
          disabledByEventId.set(eventId, next);
        }
      } else {
        // Turning OFF = adding the opt-out for this channel.
        if (disabled.has(channel)) continue; // no-op (already off)
        disabled.add(channel);
        const next = Array.from(disabled);
        ops.push(
          prisma.notificationEventOptOut.upsert({
            where: { advertiserId_eventId: { advertiserId, eventId } },
            create: { advertiserId, eventId, disabledChannels: next },
            update: { disabledChannels: { set: next } },
          }),
        );
        disabledByEventId.set(eventId, next);
      }
    }

    if (ops.length > 0) await prisma.$transaction(ops);

    res.status(200).json({
      applied: ops.length,
      rejected,
    } satisfies UpdateNotificationPreferencesResponse);
  },
);
