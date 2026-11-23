import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { UID_PREFIX } from "@tagly/models/shared";
import type {
  AdminSharesFromUidParams,
  AdminSharesFromUidQuery,
  AdminSharesSort,
} from "@tagly/models/v2/adminApp";
import type { Prisma } from "../../../../generated/prisma/client.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

const PAGE_SIZE = 10;

function orderBy(
  sort: AdminSharesSort,
): Prisma.ShareOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "highest_reward":
      return [
        { finalPrice: { finalPriceCents: "desc" } },
        { estimatedPriceCents: "desc" },
      ];
    case "lowest_reward":
      return [
        { finalPrice: { finalPriceCents: "asc" } },
        { estimatedPriceCents: "asc" },
      ];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/**
 * Resolve the share filter from a parent uid's prefix. The single endpoint
 * serves customer / advertiser / business share lists — the prefix picks which
 * foreign key to filter on. A 404 (not a 400) on an unknown parent so the
 * frontend surfaces a clean "not found".
 */
async function shareWhereFromUid(uid: string): Promise<Prisma.ShareWhereInput> {
  const prefix = uid.split("-")[0];

  if (prefix === UID_PREFIX.CUSTOMER) {
    const row = await prisma.customer.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Customer not found", 404);
    return { customerId: row.id };
  }
  if (prefix === UID_PREFIX.ADVERTISER) {
    const row = await prisma.advertiser.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Advertiser not found", 404);
    return { advertiserId: row.id };
  }
  if (prefix === UID_PREFIX.LOCAL_SUBACCOUNT) {
    const row = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (!row) throw createCustomError(4043, "Business not found", 404);
    return { localId: row.id };
  }
  throw createCustomError(4000, "UID is not a customer, advertiser, or business", 400);
}

/**
 * `GET /v2/admin/shares/from/:uid` — paginated shares for one entity, each
 * hydrated into the full `AdminShare` DTO (same hydrator the detail endpoint
 * uses). The parent type is resolved from the uid prefix. Read-only,
 * SUPER-gated in the router.
 */
export const getSharesFromUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminSharesFromUidParams;
    const { sort, page } = req.validatedQuery as AdminSharesFromUidQuery;
    const offset = (page - 1) * PAGE_SIZE;

    const where = await shareWhereFromUid(uid);

    const [total, rows] = await Promise.all([
      prisma.share.count({ where }),
      prisma.share.findMany({
        where,
        orderBy: orderBy(sort),
        skip: offset,
        take: PAGE_SIZE,
        select: { id: true, uid: true },
      }),
    ]);

    // The hydrator's `findMany({ id: { in } })` doesn't preserve the sorted id
    // order, so re-apply the page's order by uid after hydrating.
    const hydrated = await adminHydrateShare({
      shareIds: rows.map((r) => r.id),
    });
    const rank = new Map(rows.map((r, i) => [r.uid, i]));
    const shares = hydrated.sort(
      (a, b) => (rank.get(a.uid) ?? 0) - (rank.get(b.uid) ?? 0),
    );

    res.status(200).json({
      message: "Shares fetched successfully",
      shares,
      total,
      page,
      hasMore: offset + PAGE_SIZE < total,
    });
  },
);
