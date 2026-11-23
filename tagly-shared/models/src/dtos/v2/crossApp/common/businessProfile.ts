import { z } from "zod";

/**
 * Max length of a business's "about" description. The single source of truth for
 * the cap — the write boundary (advertiser/admin edit) enforces it, and the
 * customer detail DTO types against the same schema.
 */
export const BUSINESS_DESCRIPTION_MAX_LENGTH = 600;

/**
 * A business's free-text "about" blurb: trimmed and length-capped. Reused by the
 * read DTO (`BusinessPublicDetails`) and the future advertiser/admin write
 * schema so the cap lives in exactly one place.
 */
export const BusinessDescriptionSchema = z
  .string()
  .trim()
  .max(BUSINESS_DESCRIPTION_MAX_LENGTH);

/**
 * Max gallery photos (beyond the banner) on a business page. Single source of
 * truth: the advertiser write boundary (create/edit) and the customer read DTO
 * type against it. The banner is separate and always required.
 */
export const BUSINESS_MAX_PHOTOS = 8;
