import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { BusinessTypePreviewSchema } from "../../crossApp/common/businessType";
import { MediaPreviewSchema } from "../../crossApp/common/media";

/**
 * `BusinessOwnerPreview` — the lean owner-facing card of one of the
 * advertiser's own business pages: enough to render a list row / creation
 * confirmation (name over the banner + type chip + city). The full owner
 * detail/edit surface gets its own DTO when that screen is built.
 */
export const BusinessOwnerPreviewSchema = z.object({
  uid: LocalSubaccountUidSchema,
  name: z.string(),
  /** Type by slug — localized name resolved client-side from the catalog. */
  type: BusinessTypePreviewSchema,
  banner: MediaPreviewSchema,
  city: z.string(),
});
export type BusinessOwnerPreview = z.infer<typeof BusinessOwnerPreviewSchema>;
