/**
 * Shares seed (single-account dev seed) — one customer (matt), all in Prague.
 *
 * Creates 19 shares that, together, exercise EVERY customer-facing share state the
 * v2 backend can produce (see `deriveCustomerShareStatus`):
 *
 *   #  business            funding     raw status   approval   report     rating       → CustomerShareStatus
 *   1  Italian Corner      CREDITS     PAID         APPROVED   –          EXCEPTIONAL  → PAID
 *   2  Sushi Garden        CREDITS     PAID         APPROVED   –          GOOD         → PAID
 *   3  Grind Gym           CREDITS     PAID         APPROVED   –          BAD          → PAID
 *   4  Sauna World         CREDITS     PROCESSING   PENDING    –          UNRATED      → UNDER_REVIEW   (pre admin review)
 *   5  Letná Tennis Club   CREDITS     PROCESSING   APPROVED   –          UNRATED      → PROCESSING     (approved, no insights/snapshot yet)
 *   6  Good Morning Cafe   CREDITS     PROCESSING   APPROVED   PENDING    REPORTED     → REPORT_REVIEW  (reported, awaiting admin)
 *   7  Flow Yoga           CREDITS     PROCESSING   REJECTED   –          UNRATED      → REJECTED       (admin intake reject)
 *   8  Gentlemen's Cut     CREDITS     PROCESSING   APPROVED   VALID      REPORTED     → REJECTED       (report VALID)
 *   9  Karlin Espresso     SUBSIDIZED  PAID         APPROVED   –          UNRATED      → PAID
 *   10 Karlin Espresso     SUBSIDIZED  UNPAYABLE    APPROVED   –          UNRATED      → UNPAYABLE
 *   18 Bloom Cafe          CREDITS     PAID         APPROVED   –          EXCEPTIONAL  → PAID           (showcase — cafe-0.png)
 *   19 Bloom Cafe          CREDITS     PAID         APPROVED   –          GOOD         → PAID           (showcase — cafe-5.png)
 *
 * Review-tab playground (#11–#17) — extra material for every admin Review queue:
 *
 *   11 Riverside Brunch    SUBSIDIZED  PROCESSING   PENDING    –          UNRATED      → UNDER_REVIEW   (intake queue)
 *   12 Italian Corner      CREDITS     PROCESSING   PENDING    –          UNRATED      → UNDER_REVIEW   (intake queue)
 *   13 Grind Gym           CREDITS     PROCESSING   PENDING    –          UNRATED      → UNDER_REVIEW   (intake queue)
 *   14 Riverside Brunch    SUBSIDIZED  PROCESSING   APPROVED   –          UNRATED      → PROCESSING     (admin rate queue)
 *   15 Core Pilates        SUBSIDIZED  PROCESSING   APPROVED   –          UNRATED      → PROCESSING     (admin rate queue)
 *   16 Core Pilates        SUBSIDIZED  PROCESSING   APPROVED   PENDING    REPORTED     → REPORT_REVIEW  (report queue)
 *   17 Sushi Garden        CREDITS     PROCESSING   APPROVED   PENDING    REPORTED     → REPORT_REVIEW  (report queue)
 *
 * Queue totals after seeding: intake = 4 (#4,#11,#12,#13) · pending reports = 3
 * (#6,#16,#17) · unrated subsidized = 4 (#9,#10,#14,#15 — #9/#10 count too since
 * the queue doesn't filter payout status; #16 is reported → ratedAt set → out).
 * Pending links come from links.ts.
 *
 * ⚠️ TIMING + ESTIMATE DESIGN (don't casually re-tune):
 * - EVERY share is >7 days old (createdHoursAgo ≥ 169), so the frequency
 *   dampener windows (24h/7d on postedToIgAt) are empty and matt's next real
 *   share prices at a full 1.0× frequency multiplier.
 * - The v2 estimate reach is the average `insights.reach` of the 5 MOST RECENT
 *   shares (see `calculateEstBasePrice`; unmeasured shares contribute nothing,
 *   <3 samples falls back to follower-based reach ≈405). The 5 newest shares
 *   here (#18, #19, #6, #17, #16) are all measured with reaches
 *   193+110+232+238+227 = 1000 → estimated reach = 200 exactly.
 * - With reach 200, matt's Prague-weighted snapshot (geo ≈1.70× — tuned via
 *   the audience weights in customers.ts, NOT the GEO curve), demo ≈1.1×,
 *   AR 1.25× (≤250 reach), CZ 0.7×, $25 estimate eCPM: a Prague CREDITS
 *   restaurant estimates at ≈818¢ gross → ≈491¢ reward ≈ 102 Kč.
 * - The business-type multiplier (algo v11) then scales by category (values
 *   live in the @tagly/models catalogs): cafés ×0.85 (≈695¢/≈417¢ ≈ 87 Kč —
 *   Good Morning, Bloom, Karlin), sports-fitness ×1.05 (gym/tennis/yoga/
 *   pilates), beauty-wellness ×1.1 (sauna/barber ≈ restaurant numbers).
 * - ⚠️ The two Bloom Cafe showcase shares (#18, #19) are tuned for screenshots,
 *   NOT for algo fidelity: #18 pairs a 460¢ gross with a hand-set 420¢ reward
 *   (a ~9% take, not the real 40% — see `finalRewardCentsOverride`), which also
 *   drags its own low reach into the estimate window above. #19 is the honest
 *   one (380¢ gross → 228¢ reward).
 *
 * ⚠️ Approving #11 (subsidized) places a PLATFORM lock, which checks the live
 * Stripe test-mode balance — with an empty test balance the approval correctly
 * refuses with 1517 (itself a useful case to play with). CREDITS approvals
 * (#12/#13) lock the seeded advertiser budget and always succeed.
 *
 * Notes on realism (all states are reachable with the current backend):
 * - The budget lock is DEFERRED to admin approval, so PENDING (#4) and the admin
 *   intake-reject (#7) place NO lock; approved shares (#5,#6,#8 + the paid ones)
 *   do. The VALID report (#8) returns its lock. Subsidized shares lock against
 *   the platform pool: in-flight APPROVED ones (#14,#15,#16) get a seeded
 *   platform SHARE_LOCK (the payment worker requires it to settle); terminal
 *   ones (#9 PAID, #10 UNPAYABLE) are historical and stay lock-less.
 * - Insights + snapshot rows exist only where the state implies the IG workers ran
 *   (PAID, the two reported shares, and the paid subsidized one). #4/#5/#7/#10 have
 *   neither — so the payment worker can never pick them up (it requires both).
 * - No InstagramInsightsQueue/SnapshotQueue rows are created, so the IG workers
 *   never touch seeded shares (nothing scheduled to run, nothing to expire). The
 *   PAYMENT worker, if running locally, may legitimately settle the measured
 *   in-flight shares (#14,#15 — and #16/#6/#17 after a report dismissal); their
 *   seeded locks make that settle correctly instead of voiding them.
 * - #7 carries a `rejectionReason` (admin intake reject) and #8 a report
 *   `reviewMessage` — both surface as the customer's rejection reason.
 * - Advertiser available budget is reconciled DOWN to reflect the paid shares
 *   (spent) and the active CREDITS locks (#5, #6, #17 — a PENDING report keeps
 *   its lock), ending ~$1,924 available + ~$40 locked.
 */

import {
  ShareStatus,
  ShareApprovalStatus,
  IgPostType,
  TransactionKind,
  ReportType,
  ReportStatus,
} from "../../generated/prisma/client.js";
import { generateUid } from "../../utils/core/uids/generateUid.js";
import { bpsOfCents } from "../../utils/formatting/bpsOfCents.js";
import { REWARD_TAKES } from "../../constants/rewards/PRICING.js";
import { LOCK_BPS_OF_EST_PRICE } from "../../constants/rewards/PRICING.js";
import { BASE_ECPMS } from "../../constants/rewards/ECPM.js";
import { LOCAL_REWARD_ALGO_VERSION } from "../../constants/rewards/META.js";
import { sumAdvertiserCreditPurchasesCents } from "../../utils/money/ledger/advertiserCreditPurchases.js";
import { MATT_SNAPSHOT, type CustomerMap } from "./customers.js";
import { uploadSeedAssetToS3 } from "./uploadSeedAssetToS3.js";
import { bucketPrefix } from "./bucketPrefix.js";
import type { Prisma } from "../../generated/prisma/client.js";

type FundingMode = "CREDITS" | "SUBSIDIZED";

type Insights = {
  reach: number;
  views: number;
  replies: number;
  shares: number;
  profileVisits: number;
  follows: number;
  totalInteractions: number;
};

type ShareSeed = {
  n: number;
  imageKey: string;
  businessName: string;
  funding: FundingMode;
  status: ShareStatus;
  approvalStatus: ShareApprovalStatus;
  /** Quality rating as half-stars (1–10 = ½★–5★), or null = unrated. */
  ratingStars: number | null;
  report: { type: ReportType; status: ReportStatus } | null;
  /** Whether the IG insights + snapshot rows were captured (workers ran). */
  measured: boolean;
  /** Admin intake-reject reason (only #7). */
  rejectionReason?: string;
  /** Admin report-review note — surfaces as the customer rejection reason (#8). */
  reportReviewMessage?: string;
  /** Free-text report from the advertiser (#6, #8). */
  reportMessage?: string;
  /** Why the share went UNPAYABLE (#10). */
  lastProcessingError?: string;
  // timing (relative to now)
  createdHoursAgo: number;
  postedMinsBeforeCreated: number;
  ratedAfterMin: number | null;
  // economics (USD cents — stored on the ledger; the CZ client renders ≈ CZK)
  reach: number;
  estPriceCents: number;
  /** Settlement gross (PAID shares only). */
  finalPriceCents?: number;
  /**
   * ⚠️ SCREENSHOT-ONLY OVERRIDE (#18). Forces the customer's settled reward
   * instead of deriving it from `finalPriceCents` minus the platform take, so a
   * demo share can show an arbitrary gross/reward pair. This does NOT match how
   * the platform prices anything — never copy it onto a share you intend to be
   * realistic, and never mirror the pattern in product code.
   */
  finalRewardCentsOverride?: number;
  /** Business-type multiplier stamped on the FinalPrice audit row (PAID shares
   *  only; defaults to neutral 10000). Keep in sync with the @tagly/models
   *  catalog values for the share's business type (cafe 8500, gym 10500). */
  typeBps?: number;
  insights?: Insights;
};

const SHARES: ShareSeed[] = [
  // ── PAID (all three ratings) — advertiser-owned, CREDITS ──────────────────
  {
    n: 1,
    imageKey: "shares/matt/restaurant-1.png",
    businessName: "Italian Corner",
    funding: "CREDITS",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: 9, // 4.5★
    report: null,
    measured: true,
    createdHoursAgo: 240,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 120,
    reach: 238,
    estPriceCents: 960,
    finalPriceCents: 1060,
    insights: {
      reach: 244,
      views: 305,
      replies: 4,
      shares: 3,
      profileVisits: 11,
      follows: 2,
      totalInteractions: 20,
    },
  },
  {
    n: 2,
    imageKey: "shares/matt/restaurant-2.png",
    businessName: "Sushi Garden",
    funding: "CREDITS",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: 7, // 3.5★
    report: null,
    measured: true,
    createdHoursAgo: 264,
    postedMinsBeforeCreated: 45,
    ratedAfterMin: 150,
    reach: 235,
    estPriceCents: 955,
    finalPriceCents: 945,
    insights: {
      reach: 236,
      views: 296,
      replies: 3,
      shares: 2,
      profileVisits: 9,
      follows: 1,
      totalInteractions: 15,
    },
  },
  {
    n: 3,
    imageKey: "shares/matt/gym-1.png",
    businessName: "Grind Gym",
    funding: "CREDITS",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: 2, // 1★
    report: null,
    measured: true,
    createdHoursAgo: 288,
    postedMinsBeforeCreated: 30,
    ratedAfterMin: 130,
    reach: 232,
    estPriceCents: 920,
    finalPriceCents: 715, // a BAD rating drags the final price down
    typeBps: 10500, // gym → sports-fitness
    insights: {
      reach: 230,
      views: 282,
      replies: 1,
      shares: 1,
      profileVisits: 5,
      follows: 0,
      totalInteractions: 7,
    },
  },

  // ── UNDER_REVIEW — brand-new, awaiting admin intake (no lock, no data) ─────
  {
    n: 4,
    imageKey: "shares/matt/gym-2.png",
    businessName: "Sauna World",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.PENDING,
    ratingStars: null,
    report: null,
    measured: false,
    createdHoursAgo: 192,
    postedMinsBeforeCreated: 90,
    ratedAfterMin: null,
    reach: 237,
    estPriceCents: 960,
  },

  // ── PROCESSING — approved, measuring not done yet (reward countdown live) ──
  {
    n: 5,
    imageKey: "shares/matt/restaurant-3.png",
    businessName: "Letná Tennis Club",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: null,
    measured: false,
    createdHoursAgo: 190,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: null,
    reach: 239,
    estPriceCents: 920,
  },

  // ── REPORT_REVIEW — approved + measured, advertiser report pending ─────────
  {
    n: 6,
    imageKey: "shares/matt/cafe-1.png",
    businessName: "Good Morning Cafe",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: { type: ReportType.NOT_PROMOTION, status: ReportStatus.PENDING },
    reportMessage: "This story doesn't actually show or mention our cafe.",
    measured: true,
    createdHoursAgo: 172,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 200,
    reach: 234,
    estPriceCents: 820,
    insights: {
      reach: 232,
      views: 290,
      replies: 3,
      shares: 2,
      profileVisits: 9,
      follows: 2,
      totalInteractions: 16,
    },
  },

  // ── REJECTED — admin intake reject (never approved, never locked) ──────────
  {
    n: 7,
    imageKey: "shares/matt/cafe-2.png",
    businessName: "Flow Yoga",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.REJECTED,
    ratingStars: null,
    report: null,
    rejectionReason: "The story doesn't tag the studio and looks unrelated.",
    measured: false,
    createdHoursAgo: 200,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: null,
    reach: 236,
    estPriceCents: 915,
  },

  // ── REJECTED — report ruled VALID after approval; lock returned ────────────
  {
    n: 8,
    imageKey: "shares/matt/restaurant-4.png",
    businessName: "Gentlemen's Cut",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: {
      type: ReportType.MISLEADING_LOCATION,
      status: ReportStatus.VALID,
    },
    reportMessage: "The location tagged is not our barbershop.",
    reportReviewMessage:
      "Confirmed the tagged location isn't this business — report is valid.",
    measured: true,
    createdHoursAgo: 210,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 220,
    reach: 231,
    estPriceCents: 960,
    insights: {
      reach: 229,
      views: 284,
      replies: 2,
      shares: 1,
      profileVisits: 6,
      follows: 1,
      totalInteractions: 10,
    },
  },

  // ── PAID — subsidized business (platform funds the full reward) ────────────
  {
    n: 9,
    imageKey: "shares/matt/cafe-3.png",
    businessName: "Karlin Espresso",
    funding: "SUBSIDIZED",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: null,
    measured: true,
    createdHoursAgo: 312,
    postedMinsBeforeCreated: 45,
    ratedAfterMin: null,
    reach: 233,
    estPriceCents: 295,
    finalPriceCents: 290,
    typeBps: 8500, // cafe
    insights: {
      reach: 233,
      views: 292,
      replies: 2,
      shares: 2,
      profileVisits: 7,
      follows: 1,
      totalInteractions: 12,
    },
  },

  // ── UNPAYABLE — subsidized, insights/snapshot never captured (terminal) ────
  // (Second Karlin Espresso share — the old "Hyde Park Bites" page became the
  //  advertiser-owned Bloom Cafe, so the subsidized-UNPAYABLE case moved here.)
  {
    n: 10,
    imageKey: "shares/matt/cafe-4.png",
    businessName: "Karlin Espresso",
    funding: "SUBSIDIZED",
    status: ShareStatus.UNPAYABLE,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: null,
    lastProcessingError:
      "Story insights expired before they could be captured (story >24h old).",
    measured: false,
    createdHoursAgo: 336,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: null,
    reach: 235,
    estPriceCents: 295,
  },

  // ═══ Review-tab playground (#11–#17) ═══════════════════════════════════════

  // ── Intake queue — three more fresh PENDING shares (no lock, no data yet) ──
  {
    n: 11,
    imageKey: "shares/matt/cafe-3.png",
    businessName: "Riverside Brunch",
    funding: "SUBSIDIZED",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.PENDING,
    ratingStars: null,
    report: null,
    measured: false,
    createdHoursAgo: 194,
    postedMinsBeforeCreated: 45,
    ratedAfterMin: null,
    reach: 232,
    estPriceCents: 345,
  },
  {
    n: 12,
    imageKey: "shares/matt/restaurant-1.png",
    businessName: "Italian Corner",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.PENDING,
    ratingStars: null,
    report: null,
    measured: false,
    createdHoursAgo: 196,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: null,
    reach: 238,
    estPriceCents: 965,
  },
  {
    n: 13,
    imageKey: "shares/matt/gym-1.png",
    businessName: "Grind Gym",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.PENDING,
    ratingStars: null,
    report: null,
    measured: false,
    createdHoursAgo: 198,
    postedMinsBeforeCreated: 30,
    ratedAfterMin: null,
    reach: 234,
    estPriceCents: 925,
  },

  // ── Admin rate queue — approved, measured, in-flight subsidized shares ─────
  {
    n: 14,
    imageKey: "shares/matt/cafe-4.png",
    businessName: "Riverside Brunch",
    funding: "SUBSIDIZED",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: null,
    measured: true,
    createdHoursAgo: 181,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: null,
    reach: 236,
    estPriceCents: 345,
    insights: {
      reach: 242,
      views: 303,
      replies: 3,
      shares: 2,
      profileVisits: 8,
      follows: 1,
      totalInteractions: 14,
    },
  },
  {
    n: 15,
    imageKey: "shares/matt/gym-2.png",
    businessName: "Core Pilates",
    funding: "SUBSIDIZED",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: null,
    measured: true,
    createdHoursAgo: 185,
    postedMinsBeforeCreated: 45,
    ratedAfterMin: null,
    reach: 234,
    estPriceCents: 330,
    insights: {
      reach: 234,
      views: 291,
      replies: 2,
      shares: 2,
      profileVisits: 8,
      follows: 1,
      totalInteractions: 13,
    },
  },

  // ── Report queue — two more PENDING reports (one subsidized, one CREDITS) ──
  {
    n: 16,
    imageKey: "shares/matt/gym-2.png",
    businessName: "Core Pilates",
    funding: "SUBSIDIZED",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: { type: ReportType.INAPPROPRIATE, status: ReportStatus.PENDING },
    reportMessage:
      "The story contains content we don't want associated with the studio.",
    measured: true,
    createdHoursAgo: 178,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 300,
    reach: 230,
    estPriceCents: 330,
    insights: {
      reach: 227,
      views: 280,
      replies: 1,
      shares: 1,
      profileVisits: 6,
      follows: 1,
      totalInteractions: 9,
    },
  },
  {
    n: 17,
    imageKey: "shares/matt/restaurant-2.png",
    businessName: "Sushi Garden",
    funding: "CREDITS",
    status: ShareStatus.PROCESSING,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: null,
    report: { type: ReportType.DUPLICATE, status: ReportStatus.PENDING },
    reportMessage: "The same story was already submitted as another share.",
    measured: true,
    createdHoursAgo: 175,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 240,
    reach: 239,
    estPriceCents: 955,
    insights: {
      reach: 238,
      views: 298,
      replies: 3,
      shares: 2,
      profileVisits: 9,
      follows: 1,
      totalInteractions: 15,
    },
  },

  // ═══ Showcase (#18, #19) ═══════════════════════════════════════════════════

  // ── PAID — the Bloom Cafe demo share (cafe-0.png). Also the NEWEST share, so
  //    it and #19 lead the estimate window (see the header timing notes). ─────
  {
    n: 18,
    imageKey: "shares/matt/cafe-0.png",
    businessName: "Bloom Cafe",
    funding: "CREDITS",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: 9, // 4.5★
    report: null,
    measured: true,
    createdHoursAgo: 169,
    postedMinsBeforeCreated: 60,
    ratedAfterMin: 180,
    reach: 193,
    estPriceCents: 820,
    // ⚠️ Screenshot-only pair: the advertiser is debited 460¢ and the customer
    // paid 420¢, i.e. a ~9% take instead of the real 40%. Deliberate, approved
    // for demo captures only — see `finalRewardCentsOverride` on ShareSeed.
    finalPriceCents: 460,
    finalRewardCentsOverride: 420,
    typeBps: 8500, // cafe
    insights: {
      reach: 193,
      views: 248,
      replies: 5,
      shares: 3,
      profileVisits: 13,
      follows: 2,
      totalInteractions: 23,
    },
  },

  // ── PAID — second Bloom Cafe demo share (cafe-5.png). Unlike #18 this one is
  //    priced honestly: 380¢ gross → 228¢ reward after the real 40% take, and
  //    the gross tracks the algo for a cafe at reach ~109 (see header math). ──
  {
    n: 19,
    imageKey: "shares/matt/cafe-5.png",
    businessName: "Bloom Cafe",
    funding: "CREDITS",
    status: ShareStatus.PAID,
    approvalStatus: ShareApprovalStatus.APPROVED,
    ratingStars: 10, // 5★ → neutral rating multiplier
    report: null,
    measured: true,
    createdHoursAgo: 170,
    postedMinsBeforeCreated: 45,
    ratedAfterMin: 160,
    reach: 109,
    estPriceCents: 379,
    finalPriceCents: 380,
    typeBps: 8500, // cafe
    insights: {
      reach: 110,
      views: 138,
      replies: 2,
      shares: 1,
      profileVisits: 6,
      follows: 1,
      totalInteractions: 10,
    },
  },
];

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
// paidAt = createdAt + 23h 45m (payment processed ~24h after creation).
const PAID_OFFSET_MS = 23 * HOUR_MS + 45 * MIN_MS;

/** Customer reward from the gross price: subsidized pays in full, credits net the
 *  platform take. */
function customerRewardCents(gross: bigint, funding: FundingMode): bigint {
  if (funding === "SUBSIDIZED") return gross;
  return gross - bpsOfCents(gross, REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS);
}

export async function seedShares(
  tx: Prisma.TransactionClient,
  customerMap: CustomerMap,
): Promise<void> {
  console.log(`\nCreating ${SHARES.length} shares...`);

  const matt = customerMap.get("matej@taglyapp.com");
  if (!matt) throw new Error("Customer matej@taglyapp.com not found.");

  const advertiser = await tx.advertiser.findUnique({
    where: { email: "matej@taglyapp.com" },
    select: { id: true, sensitiveDataId: true },
  });
  if (!advertiser) throw new Error("Advertiser matej@taglyapp.com not found.");

  // The reviewing admin (seeded before shares). reviewedByAdminId has no FK, so
  // null is acceptable if the admin isn't present yet.
  const admin = await tx.admin.findFirst({ select: { id: true } });
  const reviewerId = admin?.id ?? null;

  const businessNames = [...new Set(SHARES.map((s) => s.businessName))];
  const locals = await tx.localSubaccount.findMany({
    where: { name: { in: businessNames } },
    select: { id: true, name: true, advertiserId: true },
  });
  const localMap = new Map(locals.map((l) => [l.name, l]));
  for (const name of businessNames) {
    if (!localMap.has(name)) {
      throw new Error(
        `Local "${name}" not found. Run businessPages seed first.`,
      );
    }
  }

  const now = Date.now();
  let customerEarningsCents = 0n; // sum of paid rewards → customer balance
  let advertiserSpentCents = 0n; // settled CREDITS payments (leave the budget)
  let advertiserLockedCents = 0n; // still-locked CREDITS (active shares)

  for (const s of SHARES) {
    const local = localMap.get(s.businessName)!;
    const isSubsidized = s.funding === "SUBSIDIZED";
    const advertiserId = isSubsidized ? null : advertiser.id;

    // ── timing ──
    const createdAt = new Date(now - s.createdHoursAgo * HOUR_MS);
    const postedToIgAt = new Date(
      createdAt.getTime() - s.postedMinsBeforeCreated * MIN_MS,
    );
    const ratedAt =
      s.ratedAfterMin != null
        ? new Date(createdAt.getTime() + s.ratedAfterMin * MIN_MS)
        : null;
    const paidAt =
      s.status === ShareStatus.PAID
        ? new Date(createdAt.getTime() + PAID_OFFSET_MS)
        : null;
    // Approved/rejected shares carry a review stamp (set at approval/reject time).
    const reviewedAt =
      s.approvalStatus === ShareApprovalStatus.PENDING
        ? null
        : new Date(createdAt.getTime() + 30 * MIN_MS);

    // ── economics ──
    const estPriceCents = BigInt(s.estPriceCents);
    const estRewardCents = customerRewardCents(estPriceCents, s.funding);
    const lockCents = bpsOfCents(estPriceCents, LOCK_BPS_OF_EST_PRICE);
    const finalPriceCents =
      s.finalPriceCents != null ? BigInt(s.finalPriceCents) : null;
    const finalRewardCents =
      finalPriceCents != null
        ? // The override is a screenshot-only escape hatch (see the type) — every
          // other share derives the reward from the gross price as the real
          // settlement path does.
          (s.finalRewardCentsOverride != null
            ? BigInt(s.finalRewardCentsOverride)
            : customerRewardCents(finalPriceCents, s.funding))
        : null;

    // ── media ──
    // Several shares reuse the same seed image (e.g. cafe-3.png on #9 and #11).
    // Media.key is @unique, so namespace by share number to keep every media row
    // unique — then upload that image to the namespaced key so it renders.
    const mediaKey = `${bucketPrefix}public/seed/s${s.n}/${s.imageKey}`;
    await uploadSeedAssetToS3(s.imageKey, mediaKey);
    const media = await tx.media.create({
      data: {
        uid: generateUid("MEDIA"),
        type: "IMAGE",
        mime: s.imageKey.endsWith(".png") ? "image/png" : "image/jpeg",
        width: 1080,
        height: 1920,
        aspectRatio: 9 / 16,
        key: mediaKey,
      },
    });

    // ── share ──
    const share = await tx.share.create({
      data: {
        uid: generateUid("SHARE"),
        customerId: matt.id,
        advertiserId,
        localId: local.id,
        mediaId: media.id,
        igPostId: `seed_post_${s.n}_${now}`,
        igPostType: IgPostType.STORY,
        postedToIgAt,
        estimatedPriceCents: estPriceCents,
        estimatedRewardCents: estRewardCents,
        estimatedAverageReach: s.reach,
        status: s.status,
        approvalStatus: s.approvalStatus,
        reviewedAt,
        reviewedByAdminId:
          s.approvalStatus === ShareApprovalStatus.PENDING ? null : reviewerId,
        rejectionReason: s.rejectionReason ?? null,
        rating: s.ratingStars, // half-stars int (1–10), null = unrated
        ratedAt,
        paidAt,
        lastProcessingError: s.lastProcessingError ?? null,
        lastProcessingErrorAt: s.lastProcessingError ? new Date() : null,
        agreedToTermsOfMonetizationAt: postedToIgAt,
        createdAt,
        fundingModeAtCreation: s.funding,
      },
    });

    // ── insights + snapshot (only where the IG workers ran) ──
    if (s.measured && s.insights) {
      await tx.shareInsights.create({
        data: {
          shareId: share.id,
          reach: s.insights.reach,
          views: s.insights.views,
          replies: s.insights.replies,
          shares: s.insights.shares,
          profileVisits: s.insights.profileVisits,
          follows: s.insights.follows,
          totalInteractions: s.insights.totalInteractions,
          fetchedAt: new Date(postedToIgAt.getTime() + 23 * HOUR_MS),
        },
      });

      const snapshot = await tx.instagramSnapshot.create({
        data: {
          shareId: share.id,
          instagramId: matt.instagramAccountId,
          followerCount: matt.followerCount,
          audienceLocationsSource: "FOLLOWER_AUDIENCE",
          audienceLocationsTotalValue: MATT_SNAPSHOT.audienceLocationsTotalValue,
          audienceGenderAgeTotalValue:
            MATT_SNAPSHOT.audienceGenderAgeTotalValue,
          snapshotTakenAt: new Date(postedToIgAt.getTime() + 23 * HOUR_MS),
        },
      });
      for (const ga of MATT_SNAPSHOT.audienceGenderAge) {
        await tx.instagramAudienceGenderAge.create({
          data: {
            snapshotId: snapshot.id,
            gender: ga.gender,
            age: ga.age,
            value: ga.value,
          },
        });
      }
      for (const loc of MATT_SNAPSHOT.audienceLocation) {
        await tx.$executeRaw`
          INSERT INTO "app"."instagram_audience_location"
            ("snapshot_id", "address", "value", "location", "source", "created_at", "updated_at")
          VALUES (
            ${snapshot.id},
            ${loc.address},
            ${loc.value},
            ${loc.location}::geography,
            'FOLLOWER_AUDIENCE'::"app"."AudienceLocationSource",
            NOW(), NOW()
          )
        `;
      }
    }

    // ── FinalPrice (written by the payment worker at settlement → PAID only) ──
    if (finalPriceCents != null) {
      const ecpmCents = BigInt(BASE_ECPMS.IG_STORY_CENTS);
      const baseValueCents = (ecpmCents * BigInt(s.reach)) / 1000n;
      const ratingMultiplierBps =
        s.ratingStars == null
          ? 10000
          : s.ratingStars >= 8
            ? 11000
            : s.ratingStars <= 3
              ? 8000
              : 10000;
      await tx.finalPrice.create({
        data: {
          shareId: share.id,
          algoVersion: LOCAL_REWARD_ALGO_VERSION,
          currency: "usd",
          qualifiedReach: s.reach,
          ecpmCents,
          baseValueCents,
          actionBonusesCents: 0n,
          geoMultiplierBps: 9000, // 2.0.2 local-reach fraction (0..1): matt's Prague-weighted snapshot ≈ 90% local
          demoMultiplierBps: 11000,
          interestMultiplierBps: 10000,
          typeMultiplierBps: s.typeBps ?? 10000,
          ratingMultiplierBps,
          frequencyMultiplierBps: 10000,
          audienceRelevanceMultiplierBps: 9000, // 2.0.2 follower-keyed AR: matt's 900 followers sit between the 500 (1.45x) and 1k (0.80x) tiers
          finalPriceCents: finalPriceCents ?? estPriceCents,
        },
      });
    }

    // ── report ──
    if (s.report) {
      await tx.shareReport.create({
        data: {
          shareId: share.id,
          reportType: s.report.type,
          reportMessage: s.reportMessage ?? null,
          status: s.report.status,
          reviewMessage: s.reportReviewMessage ?? null,
          reviewedById:
            s.report.status === ReportStatus.PENDING ? null : reviewerId,
          reviewedAt:
            s.report.status === ReportStatus.PENDING ? null : new Date(),
        },
      });
    }

    // ── ledger ──
    // Lock is placed at admin APPROVAL (deferred from creation). PENDING/intake-
    // rejected shares never lock.
    const creditsApproved =
      !isSubsidized && s.approvalStatus === ShareApprovalStatus.APPROVED;

    // Approved, still-in-flight SUBSIDIZED shares hold a PLATFORM lock. The
    // payment worker's settleSubsidizedSharePayout requires the SHARE_LOCK
    // event as its currency source of truth (1623) — without it, a worker run
    // against the seeded DB would void these shares UNPAYABLE and fire the
    // money-integrity team alert. PAID/UNPAYABLE subsidized rows are
    // historical (their lock was consumed/released) and stay lock-less.
    if (
      isSubsidized &&
      s.approvalStatus === ShareApprovalStatus.APPROVED &&
      s.status === ShareStatus.PROCESSING
    ) {
      await tx.transactionLedgerEvent.create({
        data: {
          kind: TransactionKind.SHARE_LOCK,
          currency: "usd",
          share: { connect: { id: share.id } },
          deltaPlatformCents: -lockCents,
          deltaPlatformLockedCents: lockCents,
          // Same ref shape as the real lock writer so the unlock/settle
          // idempotency refs line up if the worker touches these.
          //
          // ⚠️ EVERY seeded ledger ref in this file must match the canonical
          // writers in `utils/money/ledger/events/sharePayment/` EXACTLY
          // (`:lock:v1`, `:payment:v1`, `:unlock-remainder:v1`, `:unlock:v1`).
          // Idempotency is the (external_ref, kind) unique constraint, so a
          // seeded row written under a stale ref is INVISIBLE to it: real code
          // re-does the operation, the insert succeeds, and the money moves
          // twice. That happened on staging (A-NEW12) — a seeded
          // `share:N:unlock-full` plus a real `share:N:unlock:v1` from the
          // IG-disconnect void double-credited the advertiser and left
          // `locked_budget_usd_cents` NEGATIVE. If the writers ever rename a
          // ref, rename it here in the same commit.
          externalRef: `share:${share.id}:lock:v1`,
          meta: {
            source: "SEED",
            estimatedPriceCents: estPriceCents.toString(),
          },
          createdAt: reviewedAt ?? createdAt,
        },
      });
    }

    if (creditsApproved) {
      await tx.transactionLedgerEvent.create({
        data: {
          kind: TransactionKind.SHARE_LOCK,
          currency: "usd",
          advertiser: { connect: { id: advertiser.id } },
          share: { connect: { id: share.id } },
          deltaAdvertiserCents: -lockCents,
          deltaAdvertiserLockedCents: lockCents,
          externalRef: `share:${share.id}:lock:v1`,
          meta: {
            source: "SEED",
            estimatedPriceCents: estPriceCents.toString(),
          },
          createdAt: reviewedAt ?? createdAt,
        },
      });
    }

    if (s.status === ShareStatus.PAID && finalPriceCents != null) {
      if (isSubsidized) {
        // Platform funds the full reward; no advertiser involved.
        await tx.transactionLedgerEvent.create({
          data: {
            kind: TransactionKind.SHARE_PAYMENT,
            currency: "usd",
            customer: { connect: { id: matt.id } },
            share: { connect: { id: share.id } },
            deltaCustomerCents: finalRewardCents!,
            deltaPlatformCents: -finalRewardCents!,
            grossSharePriceCents: finalPriceCents,
            externalRef: `share:${share.id}:payment:v1`,
            meta: { source: "SEED", subsidized: true },
            createdAt: paidAt!,
          },
        });
      } else {
        const platformFeeCents = finalPriceCents - finalRewardCents!;
        await tx.transactionLedgerEvent.create({
          data: {
            kind: TransactionKind.SHARE_PAYMENT,
            currency: "usd",
            advertiser: { connect: { id: advertiser.id } },
            customer: { connect: { id: matt.id } },
            share: { connect: { id: share.id } },
            deltaAdvertiserLockedCents: -finalPriceCents,
            deltaCustomerCents: finalRewardCents!,
            deltaPlatformCents: platformFeeCents,
            grossSharePriceCents: finalPriceCents,
            externalRef: `share:${share.id}:payment:v1`,
            meta: { source: "SEED" },
            createdAt: paidAt!,
          },
        });
        // Return the unused remainder of the lock to the advertiser.
        const remainder = lockCents - finalPriceCents;
        if (remainder > 0n) {
          await tx.transactionLedgerEvent.create({
            data: {
              kind: TransactionKind.SHARE_UNLOCK,
              currency: "usd",
              advertiser: { connect: { id: advertiser.id } },
              share: { connect: { id: share.id } },
              deltaAdvertiserCents: remainder,
              deltaAdvertiserLockedCents: -remainder,
              externalRef: `share:${share.id}:unlock-remainder:v1`,
              meta: { source: "SEED" },
              createdAt: new Date(paidAt!.getTime() + 3000),
            },
          });
        }
        advertiserSpentCents += finalPriceCents;
      }
      customerEarningsCents += finalRewardCents!;
    }

    // Report ruled VALID: the full lock is returned to the advertiser.
    if (creditsApproved && s.report?.status === ReportStatus.VALID) {
      await tx.transactionLedgerEvent.create({
        data: {
          kind: TransactionKind.SHARE_UNLOCK,
          currency: "usd",
          advertiser: { connect: { id: advertiser.id } },
          share: { connect: { id: share.id } },
          deltaAdvertiserCents: lockCents,
          deltaAdvertiserLockedCents: -lockCents,
          externalRef: `share:${share.id}:unlock:v1`,
          meta: { source: "SEED", reason: "report_validated" },
          createdAt: new Date(),
        },
      });
    }

    // Active lock: an approved CREDITS share that is neither paid nor unlocked.
    if (
      creditsApproved &&
      s.status === ShareStatus.PROCESSING &&
      s.report?.status !== ReportStatus.VALID
    ) {
      advertiserLockedCents += lockCents;
    }

    console.log(
      `  → #${s.n} ${s.businessName} [${s.funding}/${s.status}/${s.approvalStatus}` +
        `${s.report ? `/report:${s.report.status}` : ""}] stars=${s.ratingStars ?? "—"}`,
    );
  }

  // ── balances ──
  await tx.customerSensitiveData.update({
    where: { id: matt.sensitiveDataId },
    data: { balanceUsdCents: customerEarningsCents },
  });
  console.log(
    `\n  → matej@taglyapp.com balance: $${(Number(customerEarningsCents) / 100).toFixed(2)}`,
  );

  // Reconcile the advertiser budget: deposit − settled − still-locked. The
  // deposit is the seeded CREDIT_PURCHASE ledger row (advertisers.ts) — read
  // back through the same ledger-derived helper production uses.
  const deposit = await sumAdvertiserCreditPurchasesCents(advertiser.id, tx);
  const available = deposit - advertiserSpentCents - advertiserLockedCents;
  await tx.advertiserSensitiveData.update({
    where: { id: advertiser.sensitiveDataId },
    data: {
      availableBudgetUsdCents: available,
      lockedBudgetUsdCents: advertiserLockedCents,
    },
  });
  console.log(
    `  → advertiser budget: $${(Number(available) / 100).toFixed(2)} available, ` +
      `$${(Number(advertiserLockedCents) / 100).toFixed(2)} locked`,
  );
}
