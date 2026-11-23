import prisma from "../../../prisma/prisma.js";
import type { ShareVoidReason } from "@tagly/models/shared";
import { ADMIN_APPROVED_SHARE_WHERE } from "../../shares/shareAccess.js";
import type { AdvertiserShareDetailsInput } from "@tagly/models/v2/advertiserApp";
import hydrateAdvertiserSharePreviews from "./hydrateAdvertiserSharePreviews.js";

/**
 * Hydrates one share into `AdvertiserShareDetails` for the detail screen: the
 * shared `AdvertiserSharePreview` (derived status, rating/report, spend, media,
 * the lean `local: { name }`) plus the detail-only fields — `paidAt` and the
 * story's Instagram `insights`.
 *
 * Insights are surfaced only on this detail (never on previews / the rate sheet):
 * the screen is rating-gated, so by the time they're visible the rating is final
 * and can't be biased by them. Every addition degrades to null and the hydrator
 * never throws (per the hydrators rule); returns null when the share can't be
 * resolved so the controller can 404.
 */
export default async function hydrateAdvertiserShareDetails(opts: {
  shareId: number;
}): Promise<AdvertiserShareDetailsInput | null> {
  const [preview] = await hydrateAdvertiserSharePreviews({
    shareIds: [opts.shareId],
  });
  if (!preview) return null;

    // Defense-in-depth: the advertiser approval gate is enforced HERE as well
  // as in the caller's query — an unapproved share hydrates to null (404).
const row = await prisma.share.findFirst({
    where: { id: opts.shareId, ...ADMIN_APPROVED_SHARE_WHERE },
    select: {
      voidReason: true,
      paidAt: true,
      // Headline story metrics (matches ShareInsights 1:1). Whole-row null until
      // the insights worker runs.
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

  return {
    ...preview,
    // Writer-guaranteed slug (typed at markShareUnpayableAndUnlock) — read
    // as-is per the hydrator rule; pre-column voids are null (generic copy).
    voidReason: (row?.voidReason as ShareVoidReason | null) ?? null,
    paidAt: row?.paidAt ?? null,
    insights: row?.insights ?? null,
  };
}
