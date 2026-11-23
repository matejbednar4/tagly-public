import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { BusinessPublicPreviewSchema } from "./businessPublicPreview";

/**
 * A business the customer has shared at ("visited"), for the shared-places list.
 * Wraps the standard `BusinessPublicPreview` (so the client renders it with the
 * shared `BusinessPreview` component) and adds the customer's per-business
 * history: how many times they've shared there and the total they've earned.
 */
export const VisitedBusinessPreviewSchema = z.object({
  business: BusinessPublicPreviewSchema,
  /** Number of shares the customer has made at this business. */
  visitsCount: z.number().int().nonnegative(),
  /** Total the customer has earned from this business (paid shares only). */
  totalEarnedCents: CentsSchema,
  /** The customer's most recent share at this business. */
  lastVisitedAt: ISODateSchema,
});

export type VisitedBusinessPreview = z.infer<typeof VisitedBusinessPreviewSchema>;
