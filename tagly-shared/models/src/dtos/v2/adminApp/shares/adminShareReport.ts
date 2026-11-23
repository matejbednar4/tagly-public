import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { ReportTypeSchema, ReportStatusSchema } from "../../../../core/enums";

/**
 * A share's advertiser report, admin view — the full `ShareReport` row (unlike
 * the customer/advertiser `ShareReportOwner`, admin sees the review resolution
 * too). `status`: PENDING (holds payout) / VALID (upheld → share rejected,
 * rating penalty) / DISMISSED (kept). A report always implies the share's
 * `ratedAt` is set (filing counts as acting on the share).
 */
export const AdminShareReportSchema = z.object({
  reportType: ReportTypeSchema,
  reportMessage: z.string().nullable(),
  status: ReportStatusSchema,
  reviewMessage: z.string().nullable(),
  reviewedById: z.number().nullable(),
  reviewedAt: ISODateSchema.nullable(),
  createdAt: ISODateSchema,
});
export type AdminShareReport = z.infer<typeof AdminShareReportSchema>;
export type AdminShareReportInput = z.input<typeof AdminShareReportSchema>;
