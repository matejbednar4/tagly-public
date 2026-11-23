/**
 * Lists recent admin blasts (newest first) with live delivery stats
 * (`GET /v2/admin/notifications/blasts`).
 *
 * Each blast's stats are computed from the NotificationQueue rows that share
 * its dedupeKey (scheduled / processing / sent = DONE / failed). Queue rows
 * are cleaned up over time (FAILED after 24h, DONE by the cleanup worker), so
 * the stats DECAY: once no rows remain, `stats` is null and the permanent
 * `queuedCount` on the log row is the only surviving number. Push opens live
 * in PostHog (`push_opened` with slug `admin.blast:<blast slug>`);
 * email deliverability lives in the Resend dashboard via the `blast` tag.
 */

import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import type {
  AdminGetBlastsResponse,
  AdminBlast,
} from "@tagly/models/v2/adminApp";

const BLASTS_PAGE_SIZE = 20;

export const adminGetBlasts: RequestHandler = asyncHandler(async (_req, res) => {
  const logs = await prisma.adminBlastLog.findMany({
    orderBy: { sentAt: "desc" },
    take: BLASTS_PAGE_SIZE,
  });

  const dedupeKeys = logs.map((l) => l.dedupeKey);
  const counts = dedupeKeys.length
    ? await prisma.notificationQueue.groupBy({
        by: ["dedupeKey", "status"],
        where: { dedupeKey: { in: dedupeKeys } },
        _count: { _all: true },
      })
    : [];

  const statsByKey = new Map<
    string,
    { scheduled: number; processing: number; sent: number; failed: number }
  >();
  for (const row of counts) {
    if (!row.dedupeKey) continue;
    const s = statsByKey.get(row.dedupeKey) ?? {
      scheduled: 0,
      processing: 0,
      sent: 0,
      failed: 0,
    };
    if (row.status === "SCHEDULED") s.scheduled += row._count._all;
    else if (row.status === "PROCESSING") s.processing += row._count._all;
    else if (row.status === "DONE") s.sent += row._count._all;
    else if (row.status === "FAILED") s.failed += row._count._all;
    statsByKey.set(row.dedupeKey, s);
  }

  const blasts = logs.map((l): AdminBlast => {
    // CS presence is derived from the full per-language content record.
    const content = l.content as {
      push?: { cs?: unknown };
      email?: { cs?: unknown };
    } | null;
    const hasCs = Boolean(content?.push?.cs || content?.email?.cs);

    return {
      uid: l.uid,
      slug: l.slug,
      audience: l.audience,
      senderDomain: l.senderDomain,
      languages: hasCs ? ["en", "cs"] : ["en"],
      targets: l.targets as AdminBlast["targets"],
      channels: l.channels as AdminBlast["channels"],
      pushTitle: l.pushTitle,
      pushBody: l.pushBody,
      emailSubject: l.emailSubject,
      emailBody: l.emailBody,
      emailTitle: l.emailTitle,
      emailPreheader: l.emailPreheader,
      ctaLabel: l.ctaLabel,
      queuedCount: l.queuedCount,
      sentAt: l.sentAt.toISOString(),
      stats: statsByKey.get(l.dedupeKey) ?? null,
    };
  });

  res.status(200).json({
    message: "Blasts fetched",
    blasts,
  } satisfies AdminGetBlastsResponse);
});
