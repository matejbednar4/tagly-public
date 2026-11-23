import prisma from "../../../prisma/prisma.js";
import { LIVE_SHARE_WHERE } from "../../shares/shareAccess.js";
import { advertiserTypeBySlug, type VerticalSlug } from "@tagly/models/shared";

/**
 * The set of verticals a customer has actually shared into — derived from the
 * distinct business types of their non-rejected shares, mapped through the
 * advertiser-type catalog to verticals. A backend util (not its own endpoint):
 * it's a behavioural taste signal the Discover endpoints fold in alongside the
 * customer's declared interests when selecting candidates.
 *
 * Excludes REJECTED / UNPAYABLE shares (those didn't represent a genuine visit
 * the customer chose to post). Returns an empty set for a customer who hasn't
 * shared yet (cold start) — callers fall back to nearby businesses.
 */
export async function getCustomerSharedVerticals(
  customerId: number,
): Promise<Set<VerticalSlug>> {
  // Distinct business types the customer has shared into. Bounded by the number
  // of distinct types, so no need to scan every share row.
  const rows = await prisma.localSubaccount.findMany({
    where: {
      shares: {
        some: {
          customerId,
          ...LIVE_SHARE_WHERE,
        },
      },
    },
    select: { type: { select: { slug: true } } },
    distinct: ["typeId"],
  });

  const verticals = new Set<VerticalSlug>();
  for (const row of rows) {
    const def = advertiserTypeBySlug.get(row.type.slug);
    if (def) for (const v of def.verticalSlugs as VerticalSlug[]) verticals.add(v);
  }
  return verticals;
}
