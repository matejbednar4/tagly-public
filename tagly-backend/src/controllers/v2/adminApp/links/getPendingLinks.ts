import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { ADMIN_REVIEW } from "../../../../constants/platform/ADMIN_REVIEW.js";
import type {
  AdminLinkSlot,
  AdminPendingLinkInput,
} from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/links/pending` — the link-review queue, oldest first with the
 * full outstanding total. A link is created PENDING (Safe Browsing auto-rejects
 * only known-bad URLs) and customers only ever see APPROVED links, so this
 * queue is the sole path that puts submitted business links live.
 *
 * Each entry carries every business referencing the URL (a Link row is shared,
 * de-duplicated by url) with the slot(s) it fills — the reviewer needs to see
 * what the link claims to be for. Businesses of any status are listed (admin
 * surface, unfiltered), and a link whose page was deleted can simply be
 * reviewed for the registry (or rejected).
 */
export const getPendingLinks: RequestHandler = asyncHandler(
  async (_req, res) => {
    const where = { status: "PENDING" } as const;

    const businessSelect = { select: { uid: true, name: true } } as const;

    const [rows, total] = await Promise.all([
      prisma.link.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: ADMIN_REVIEW.QUEUE_PAGE_SIZE,
        select: {
          id: true,
          url: true,
          createdAt: true,
          websiteLocals: businessSelect,
          reservationLocals: businessSelect,
          menuLocals: businessSelect,
        },
      }),
      prisma.link.count({ where }),
    ]);

    const links: AdminPendingLinkInput[] = rows.map((row) => {
      // Merge the three slot relations into one per-business entry (the same
      // business may use one URL in several slots).
      const byUid = new Map<
        string,
        { uid: string; name: string; slots: AdminLinkSlot[] }
      >();
      const add = (
        businesses: { uid: string; name: string }[],
        slot: AdminLinkSlot
      ) => {
        for (const b of businesses) {
          const entry = byUid.get(b.uid) ?? { ...b, slots: [] };
          entry.slots.push(slot);
          byUid.set(b.uid, entry);
        }
      };
      add(row.websiteLocals, "website");
      add(row.reservationLocals, "reservation");
      add(row.menuLocals, "menu");

      return {
        id: row.id,
        url: row.url,
        createdAt: row.createdAt,
        businesses: [...byUid.values()],
      };
    });

    res.status(200).json({
      message: "Pending links fetched successfully",
      links,
      total,
    });
  }
);
