import { z } from "zod";
import { ReportStatusSchema, ReportTypeSchema } from "../../../../core/enums";

/**
 * A share report as its owning advertiser sees it — the reason they flagged the
 * share plus where admin review stands. Present on a share preview/detail only
 * when the advertiser has reported it (a rating and a report are mutually
 * exclusive). The enums are shared `core/` primitives.
 */
export const ShareReportOwnerSchema = z.object({
  reportType: ReportTypeSchema,
  reportMessage: z.string().nullable(),
  status: ReportStatusSchema,
});
export type ShareReportOwner = z.infer<typeof ShareReportOwnerSchema>;
