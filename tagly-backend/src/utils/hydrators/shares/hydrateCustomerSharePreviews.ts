import prisma from "../../../prisma/prisma.js";
import { mediaPreviewSelect } from "../../../prisma/selects/shared/common/media.preview.select.js";
import type { CustomerSharePreviewInput } from "@tagly/models/v2/customerApp";
import { deriveCustomerShareStatus } from "./deriveCustomerShareStatus.js";

/**
 * Hydrates a set of share ids into `CustomerSharePreview`s, preserving the input
 * id order (the caller sorts + paginates and passes the page's ids). Pure
 * shaping: filtering/sorting/pagination is the controller's job.
 *
 * `finalRewardCents` is summed from the share's SHARE_PAYMENT ledger deltas (null
 * until any payment exists). Never throws on stored data (per the hydrators
 * rule): an id that no longer resolves (e.g. raced deletion) is skipped.
 */
export default async function hydrateCustomerSharePreviews(opts: {
  shareIds: number[];
}): Promise<CustomerSharePreviewInput[]> {
  const rows = await prisma.share.findMany({
    where: { id: { in: opts.shareIds } },
    select: {
      id: true,
      uid: true,
      status: true,
      approvalStatus: true, // for the derived customer status
      report: { select: { status: true } }, // for the derived customer status
      createdAt: true,
      postedToIgAt: true,
      igPostType: true,
      estimatedRewardCents: true,
      estimatedAverageReach: true,
      rating: true, // half-stars int (1–10 = ½★–5★), null = unrated
      media: { select: mediaPreviewSelect },
      thumbnail: { select: mediaPreviewSelect },
      local: { select: { name: true } },
      ledgerEvents: {
        where: { kind: "SHARE_PAYMENT" },
        select: { deltaCustomerCents: true },
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));

  const toMedia = (m: (typeof rows)[number]["thumbnail"]) =>
    m ? { uid: m.uid, key: m.key, aspectRatio: m.aspectRatio, type: m.type } : null;

  return opts.shareIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => ({
      uid: row.uid,
      // Single derived customer-facing status (raw status stays backend-internal).
      status: deriveCustomerShareStatus({
        status: row.status,
        approvalStatus: row.approvalStatus,
        reportStatus: row.report?.status ?? null,
      }),
      createdAt: row.createdAt,
      postedToIgAt: row.postedToIgAt,
      igPostType: row.igPostType,
      estimatedRewardCents: row.estimatedRewardCents,
      estimatedAverageReach: row.estimatedAverageReach,
      finalRewardCents:
        row.ledgerEvents.length > 0
          ? row.ledgerEvents.reduce((sum, e) => sum + e.deltaCustomerCents, 0n)
          : null,
      // Canonical half-stars int (1–10), straight from the column; null = unrated.
      ratingStars: row.rating,
      // A share always has a media row; thumbnail/local can be absent.
      media: toMedia(row.media)!,
      thumbnail: toMedia(row.thumbnail),
      local: row.local ? { name: row.local.name } : null,
    }));
}
