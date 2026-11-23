import prisma from "../../../prisma/prisma.js";
import {
  ADMIN_APPROVED_SHARE_WHERE,
  isAdvertiserAssessableShare,
} from "../../shares/shareAccess.js";
import { mediaPreviewSelect } from "../../../prisma/selects/shared/common/media.preview.select.js";
import { deriveAdvertiserShareStatus } from "./deriveAdvertiserShareStatus.js";
import type { AdvertiserSharePreviewInput } from "@tagly/models/v2/advertiserApp";

/**
 * Hydrates a set of share ids into `AdvertiserSharePreview`s, preserving the
 * input id order (the caller sorts + paginates and passes the page's ids). Pure
 * shaping: filtering/sorting/pagination is the controller's job.
 *
 * Composite select inlined per the single-consumer rule:
 *   - `status` is derived via `deriveAdvertiserShareStatus` (raw status + the
 *     report outcome) — a VALID report reads REJECTED and a pending report
 *     reads REPORT_REVIEW instead of resting at the raw PROCESSING.
 *   - `rating` is the stored half-stars column (null = unrated); the legacy
 *     `Rating` enum is gone.
 *   - `report` is present only when the advertiser reported the share (mutually
 *     exclusive with a rating).
 *   - `finalPriceCents` is summed from the share's SHARE_PAYMENT advertiser
 *     ledger deltas (available + locked) and negated — the deltas are advertiser
 *     debits (negative), while the DTO carries the price as a positive magnitude
 *     (same convention as `adminHydrateShare`). Null until any payment exists.
 *
 * Never throws on stored data (per the hydrators rule): an id that no longer
 * resolves (e.g. raced deletion) is skipped.
 */
export default async function hydrateAdvertiserSharePreviews(opts: {
  shareIds: number[];
}): Promise<AdvertiserSharePreviewInput[]> {
  if (!opts.shareIds.length) return [];

  // Defense-in-depth: the advertiser approval gate is enforced HERE as well as
  // in the callers' queries — an unapproved share id slipping in is silently
  // dropped, never shown to the advertiser.
  const rows = await prisma.share.findMany({
    where: { id: { in: opts.shareIds }, ...ADMIN_APPROVED_SHARE_WHERE },
    select: {
      id: true,
      uid: true,
      status: true, // raw axis; combined with report.status by the derive
      approvalStatus: true, // for the shouldAssessShare twin (rows are APPROVED)
      customerId: true, // null (customer deleted) → not assessable
      createdAt: true,
      postedToIgAt: true,
      igPostType: true,
      estimatedPriceCents: true,
      rating: true, // half-stars int (1–10 = ½★–5★), null = unrated
      ratedAt: true,
      fundingModeAtCreation: true, // → isSubsidized
      report: {
        select: { reportType: true, reportMessage: true, status: true },
      },
      media: { select: mediaPreviewSelect },
      thumbnail: { select: mediaPreviewSelect },
      local: { select: { name: true } },
      ledgerEvents: {
        where: { kind: "SHARE_PAYMENT" },
        select: {
          deltaAdvertiserCents: true,
          deltaAdvertiserLockedCents: true,
        },
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));

  const toMedia = (m: (typeof rows)[number]["thumbnail"]) =>
    m
      ? { uid: m.uid, key: m.key, aspectRatio: m.aspectRatio, type: m.type }
      : null;

  return opts.shareIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => ({
      uid: row.uid,
      status: deriveAdvertiserShareStatus({
        status: row.status,
        reportStatus: row.report?.status ?? null,
      }),
      createdAt: row.createdAt,
      postedToIgAt: row.postedToIgAt,
      igPostType: row.igPostType,
      estimatedPriceCents: row.estimatedPriceCents,
      // The SHARE_PAYMENT deltas are advertiser debits (negative); the DTO's
      // price is their positive magnitude. A subsidized share's advertiser
      // deltas are 0, so it correctly reads as a $0 spend.
      finalPriceCents:
        row.ledgerEvents.length > 0
          ? -row.ledgerEvents.reduce(
              (sum, e) =>
                sum + e.deltaAdvertiserCents + e.deltaAdvertiserLockedCents,
              0n
            )
          : null,
      // Canonical half-stars int, straight from the column; null = unrated.
      rating: row.rating,
      ratedAt: row.ratedAt,
      // Single source of truth for "the advertiser should rate this" — the same
      // predicate the unrated queue filters on. False for an already-assessed
      // share or one whose customer was deleted (nothing to rate).
      shouldAssessShare: isAdvertiserAssessableShare(row),
      report: row.report
        ? {
            reportType: row.report.reportType,
            reportMessage: row.report.reportMessage,
            status: row.report.status,
          }
        : null,
      isSubsidized: row.fundingModeAtCreation === "SUBSIDIZED",
      // A share always has a media row; thumbnail/local can be absent.
      media: toMedia(row.media)!,
      thumbnail: toMedia(row.thumbnail),
      local: row.local ? { name: row.local.name } : null,
    }));
}
