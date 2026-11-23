import prisma from "../../../prisma/prisma.js";
import type { ShareVoidReason } from "@tagly/models/shared";
import type { CustomerShareDetailsInput } from "@tagly/models/v2/customerApp";
import hydrateCustomerSharePreviews from "./hydrateCustomerSharePreviews.js";
import hydrateBusinessPublicPreviews from "../businesses/hydrateBusinessPublicPreviews.js";

/**
 * Hydrates one share into `CustomerShareDetails` for the detail page: the shared
 * `CustomerSharePreview` (incl. the derived customer-facing status, with the lean
 * `local: { name }`) plus the detail-only fields — the full `business` public
 * preview (so the screen can render a BusinessPreview card), the `rejectionReason`,
 * `paidAt`, and the story's Instagram `insights`. Every addition degrades to null
 * and the hydrator never throws (per the hydrators rule). Returns null when the
 * share can't be resolved so the controller can 404.
 *
 * `rejectionReason` is ONLY the admin's intake-reject reason (`share.rejectionReason`,
 * set by adminRejectShare). A VALID-report rejection deliberately has no reason
 * here — we don't surface the advertiser's report to the customer — so it stays
 * null, and the screen detects "rejected by report" as REJECTED + a null reason.
 */
export default async function hydrateCustomerShareDetails(opts: {
  shareId: number;
  customerId: number;
}): Promise<CustomerShareDetailsInput | null> {
  const [preview] = await hydrateCustomerSharePreviews({
    shareIds: [opts.shareId],
  });
  if (!preview) return null;

  const row = await prisma.share.findUnique({
    where: { id: opts.shareId },
    select: {
      rejectionReason: true,
      voidReason: true,
      paidAt: true,
      local: { select: { id: true } },
      // The headline story metrics the customer detail shows (matches
      // CustomerShareInsights 1:1). Null whole-row until the insights worker runs.
      insights: {
        select: {
          reach: true,
          views: true,
          replies: true,
          profileVisits: true,
          follows: true,
          shares: true,
          totalInteractions: true,
        },
      },
    },
  });

  // The canonical business preview (name, banner, type, reward estimate keyed to
  // this customer). Reuses the map/search hydrator; it degrades to null — e.g. a
  // business whose address has no readable coordinates is dropped (it returns []).
  const [business] = row?.local
    ? await hydrateBusinessPublicPreviews({
        businessIds: [row.local.id],
        customerId: opts.customerId,
      })
    : [];

  return {
    ...preview,
    business: business ?? null,
    // Admin intake-reject reason only. A VALID-report rejection stays null here
    // (we don't surface the advertiser's report); the screen reads REJECTED + null
    // reason as "rejected by report".
    rejectionReason: row?.rejectionReason ?? null,
    // Writer-guaranteed slug (typed at markShareUnpayableAndUnlock) — read
    // as-is per the hydrator rule; pre-column voids are null (generic copy).
    voidReason: (row?.voidReason as ShareVoidReason | null) ?? null,
    paidAt: row?.paidAt ?? null,
    insights: row?.insights ?? null,
  };
}
