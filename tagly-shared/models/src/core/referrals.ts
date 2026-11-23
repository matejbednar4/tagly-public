import { z } from "zod";

/**
 * Referral codes:
 * - trimmed, lowercased
 * - only [a-z0-9_.-]
 * - cannot end with "."
 */
export const ReferralCodeSchema = z
  .string()
  .trim()
  .toLowerCase() // ensures consumer always gets lowercase
  .regex(/^[a-z0-9_.-]+$/, "Only a-z, 0-9, underscore, dot, and dash allowed")
  .refine((val) => !val.endsWith("."), {
    message: "Referral code cannot end with a dot",
  });

export type ReferralCode = z.infer<typeof ReferralCodeSchema>;