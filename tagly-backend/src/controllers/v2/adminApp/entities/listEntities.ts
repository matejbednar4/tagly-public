import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  AdminListEntitiesQuery,
  AdminListEntityType,
  AdminListSort,
} from "@tagly/models/v2/adminApp";
import { db } from "../../../../db/kysely.js";
import adminHydrateCustomer from "../../../../utils/hydrators/admin/adminHydrateCustomer.js";
import adminHydrateAdvertiser from "../../../../utils/hydrators/admin/adminHydrateAdvertiser.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

const PAGE_SIZE = 10;

type SortCol = { col: string; dir: "asc" | "desc" };

function resolveSort(type: AdminListEntityType, sort: AdminListSort): SortCol {
  switch (sort) {
    case "oldest":
      return { col: "created_at", dir: "asc" };
    case "name_asc":
      if (type === "customer") return { col: "full_name", dir: "asc" };
      if (type === "local") return { col: "name", dir: "asc" };
      if (type === "advertiser") return { col: "email", dir: "asc" };
      return { col: "created_at", dir: "desc" };
    case "name_desc":
      if (type === "customer") return { col: "full_name", dir: "desc" };
      if (type === "local") return { col: "name", dir: "desc" };
      if (type === "advertiser") return { col: "email", dir: "desc" };
      return { col: "created_at", dir: "desc" };
    case "newest":
    default:
      return { col: "created_at", dir: "desc" };
  }
}

/**
 * `GET /v2/admin/entities` — one entity type per call, 10 per page, each fully
 * hydrated into its admin detail DTO. SUPER-only.
 */
export const listEntities: RequestHandler = asyncHandler(async (req, res) => {
  const { type, sort, page } = req.validatedQuery as AdminListEntitiesQuery;
  const offset = (page - 1) * PAGE_SIZE;
  const { col, dir } = resolveSort(type, sort);

  let total = 0;
  let customers: Awaited<ReturnType<typeof adminHydrateCustomer>>[] = [];
  let advertisers: Awaited<ReturnType<typeof adminHydrateAdvertiser>>[] = [];
  let locals: Awaited<ReturnType<typeof adminHydrateLocal>> = [];
  let shares: Awaited<ReturnType<typeof adminHydrateShare>> = [];

  const countAndPage = async (table: "app.customers" | "app.advertisers" | "app.local_subaccounts" | "app.shares") => {
    const [countRow, rows] = await Promise.all([
      db
        .selectFrom(table)
        .select(db.fn.countAll<number>().as("count"))
        .executeTakeFirst(),
      db
        .selectFrom(table)
        .select("id")
        .orderBy(col as never, dir)
        .limit(PAGE_SIZE)
        .offset(offset)
        .execute(),
    ]);
    return { total: Number(countRow?.count ?? 0), ids: rows.map((r) => r.id) };
  };

  if (type === "customer") {
    const { total: t, ids } = await countAndPage("app.customers");
    total = t;
    customers = await Promise.all(
      ids.map((id) => adminHydrateCustomer({ customerId: id })),
    );
  } else if (type === "advertiser") {
    const { total: t, ids } = await countAndPage("app.advertisers");
    total = t;
    advertisers = await Promise.all(
      ids.map((id) => adminHydrateAdvertiser({ advertiserId: id })),
    );
  } else if (type === "local") {
    const { total: t, ids } = await countAndPage("app.local_subaccounts");
    total = t;
    locals = await adminHydrateLocal({ localIds: ids });
  } else {
    const { total: t, ids } = await countAndPage("app.shares");
    total = t;
    shares = await adminHydrateShare({ shareIds: ids });
  }

  res.status(200).json({
    message: "Entities fetched successfully",
    customers,
    advertisers,
    locals,
    shares,
    total,
    page,
    hasMore: offset + PAGE_SIZE < total,
  });
});
