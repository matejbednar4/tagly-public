import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type {
  AdminSearchQuery,
  AdminCustomerInput,
  AdminAdvertiserInput,
  AdminBusinessInput,
  AdminShareInput,
} from "@tagly/models/v2/adminApp";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import adminHydrateCustomer from "../../../../utils/hydrators/admin/adminHydrateCustomer.js";
import adminHydrateAdvertiser from "../../../../utils/hydrators/admin/adminHydrateAdvertiser.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

const MAX_RESULTS_PER_TYPE = 10;

type SearchResult = {
  customers: AdminCustomerInput[];
  advertisers: AdminAdvertiserInput[];
  locals: AdminBusinessInput[];
  shares: AdminShareInput[];
};

/** Escape LIKE special chars, then wrap in wildcards. */
function likePattern(q: string): string {
  return "%" + q.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
}

function uniqueIds(rows: { id: number }[]): number[] {
  return [...new Set(rows.map((r) => r.id))].slice(0, MAX_RESULTS_PER_TYPE);
}

async function searchAll(q: string): Promise<SearchResult> {
  const pattern = likePattern(q);
  // Strip leading @ so "@tagly" and "tagly" both match instagram handles.
  const igPattern = likePattern(q.replace(/^@+/, ""));

  const [
    customersByEmail,
    customersByName,
    customersByIg,
    customersByUid,
    advertisersByEmail,
    advertisersByUid,
    localsByName,
    localsByIg,
    localsByUid,
    sharesByUid,
  ] = await Promise.all([
    db.selectFrom("app.customers as c").select("c.id").where(sql<boolean>`c.email ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.customers as c").select("c.id").where(sql<boolean>`c.full_name ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.customer_instagram_accounts as cia").select("cia.customerId").where(sql<boolean>`cia.username ILIKE ${igPattern}`).where("cia.customerId", "is not", null).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.customers as c").select("c.id").where(sql<boolean>`c.uid ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.advertisers as a").select("a.id").where(sql<boolean>`a.email ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.advertisers as a").select("a.id").where(sql<boolean>`a.uid ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.local_subaccounts as ls").select("ls.id").where(sql<boolean>`ls.name ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.local_subaccounts as ls").select("ls.id").where(sql<boolean>`ls.instagram_tag ILIKE ${igPattern}`).where("ls.instagram_tag", "is not", null).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.local_subaccounts as ls").select("ls.id").where(sql<boolean>`ls.uid ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
    db.selectFrom("app.shares as s").select("s.id").where(sql<boolean>`s.uid ILIKE ${pattern}`).limit(MAX_RESULTS_PER_TYPE).execute(),
  ]);

  const customerIds = uniqueIds([
    ...customersByEmail,
    ...customersByName,
    ...customersByIg.map((r) => ({ id: r.customerId as number })),
    ...customersByUid,
  ]);
  const advertiserIds = uniqueIds([...advertisersByEmail, ...advertisersByUid]);
  const localIds = uniqueIds([...localsByName, ...localsByIg, ...localsByUid]);
  const shareIds = uniqueIds(sharesByUid);

  const [customers, advertisers, locals, shares] = await Promise.all([
    customerIds.length > 0
      ? Promise.all(customerIds.map((id) => adminHydrateCustomer({ customerId: id })))
      : Promise.resolve([]),
    advertiserIds.length > 0
      ? Promise.all(advertiserIds.map((id) => adminHydrateAdvertiser({ advertiserId: id })))
      : Promise.resolve([]),
    localIds.length > 0 ? adminHydrateLocal({ localIds }) : Promise.resolve([]),
    shareIds.length > 0 ? adminHydrateShare({ shareIds }) : Promise.resolve([]),
  ]);

  return { customers, advertisers, locals, shares };
}

/** `GET /v2/admin/search` — fuzzy ILIKE across all entity types, ≤10 each. */
export const search: RequestHandler = asyncHandler(async (req, res) => {
  const { q } = req.validatedQuery as AdminSearchQuery;
  const result = await searchAll(q.trim());
  res.status(200).json({
    message: "Search results fetched successfully",
    ...result,
  });
});
