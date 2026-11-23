import { ReportType } from "../../generated/prisma/client.js";

export const REPORT_PENALTIES = {
  BASE_PENALTIES_BPS: {
    // Worst offenses - defeats the purpose of sharing
    [ReportType.NOT_PROMOTION]: -2250, // -0.225x

    // Fraud-like behavior
    [ReportType.CUSTOMER_NOT_SPENT_MONEY]: -1800, // -0.18x

    // Deceptive/problematic content
    [ReportType.MISLEADING_LOCATION]: -1500, // -0.15x
    [ReportType.INAPPROPRIATE]: -1500, // -0.15x
    [ReportType.VIOLATES_GUIDELINES]: -1500, // -0.15x

    // Mildest - still a valid promotion, just duplicated
    [ReportType.DUPLICATE]: -450, // -0.045x
  },
};

/**
 * Flat penalty applied to the customer's reward multiplier when an admin REJECTS
 * their share during pre-approval review (adminRejectShare). A rejected share was
 * deemed bad/fake before the business ever saw it, so the penalty is meaningful —
 * stronger than a BAD rating (-0.075x), on par with the mid-tier report penalties.
 * Repeated rejections stack down to CUSTOMER_RATING_MULTIPLIER.minBps (the
 * multiplier helper clamps to it). Bump this if rejection abuse needs a harder hit.
 */
export const SHARE_REJECTION_PENALTY_BPS = -1500; // -0.15x
