import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { UID_PREFIX } from "@tagly/models/shared";
import type {
  AdminLedgerEventsFromUidParams,
  AdminLedgerEventsFromUidQuery,
  AdminLedgerSort,
} from "@tagly/models/v2/adminApp";
import type { Prisma } from "../../../../generated/prisma/client.js";
import prisma from "../../../../prisma/prisma.js";
import adminHydrateLedgerEvents from "../../../../utils/hydrators/admin/adminHydrateLedgerEvents.js";

const PAGE_SIZE = 20;

function orderBy(
  sort: AdminLedgerSort,
): Prisma.TransactionLedgerEventOrderByWithRelationInput[] {
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  // "newest" (default)
  return [{ createdAt: "desc" }, { id: "desc" }];
}

/**
 * Resolve the ledger filter from a parent uid's prefix. Ledger events are
 * scoped to an advertiser or a customer, so a business (local-subaccount) uid
 * resolves to its advertiser's ledger — parity with the origin admin endpoint.
 * An advertiser-less (subsidized/unowned) business resolves to a match-nothing
 * filter — an empty trail, never `advertiserId: null` (see the E035 comment
 * below). A 404 (not 400) on an unknown parent so the frontend shows a clean
 * "not found".
 */
async function ledgerWhereFromUid(
  uid: string,
): Promise<Prisma.TransactionLedgerEventWhereInput> {
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
      select: { advertiserId: true },
    });
    if (!row) throw createCustomError(4043, "Business not found", 404);
    if (row.advertiserId === null) {
      // Subsidized / unowned business — there is no advertiser ledger to show.
      // Return a match-nothing filter: a literal `{ advertiserId: null }` would
      // render as `advertiser_id IS NULL` and list every advertiser-less event
      // on the platform (customer withdrawals, subsidized settles, …) as this
      // business's money trail (E035).
      return { advertiserId: { in: [] } };
    }
    // A business has no ledger of its own — show its advertiser's trail.
    return { advertiserId: row.advertiserId };
  }
  throw createCustomError(
    4000,
    "UID is not a customer, advertiser, or business",
    400,
  );
}

/**
 * `GET /v2/admin/ledger-events/from/:uid` — the entity-wide, chronological money
 * trail for one account, paginated (20/page) and hydrated into `AdminLedgerEvent`
 * via the same hydrator the detail screens use. The parent type is resolved from
 * the uid prefix. Read-only, SUPER-gated in the router.
 */
export const getLedgerEventsFromUid: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminLedgerEventsFromUidParams;
    const { sort, page } = req.validatedQuery as AdminLedgerEventsFromUidQuery;
    const offset = (page - 1) * PAGE_SIZE;

    const where = await ledgerWhereFromUid(uid);

    const [total, rows] = await Promise.all([
      prisma.transactionLedgerEvent.count({ where }),
      prisma.transactionLedgerEvent.findMany({
        where,
        orderBy: orderBy(sort),
        skip: offset,
        take: PAGE_SIZE,
        select: { id: true },
      }),
    ]);

    // The hydrator preserves the order of the ids it's handed, so passing the
    // already-sorted page keeps the response in ledger order.
    const events = await adminHydrateLedgerEvents({
      ledgerEventIds: rows.map((r) => r.id),
    });

    res.status(200).json({
      message: "Ledger events retrieved successfully",
      events,
      total,
      page,
      hasMore: offset + PAGE_SIZE < total,
    });
  },
);
