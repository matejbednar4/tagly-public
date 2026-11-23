import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { AccountReferralStatusSchema } from "../../../../core/enums";

/**
 * An account's referral standing, identical in shape for customers and
 * advertisers (both own an `AccountReferral`). `referredBy` is who invited this
 * account (null if organic); the counts are how many this account has referred.
 */
export const AdminReferralSchema = z.object({
  code: z.string(),
  status: AccountReferralStatusSchema,
  referredUsersCount: z.number(),
  referredBusinessesCount: z.number(),
  referredBy: z
    .object({
      code: z.string(),
      at: ISODateSchema,
      referrerUid: z.string(),
      referrerType: z.enum(["customer", "advertiser"]),
      /**
       * Present when an admin linked the two accounts after the fact (the
       * sales-assisted case, `POST /v2/admin/advertisers/:uid/referrer`).
       * Null = the account entered the code itself in-app.
       */
      setByAdmin: z
        .object({
          uid: z.string(),
          username: z.string(),
          reason: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
});
export type AdminReferral = z.infer<typeof AdminReferralSchema>;
export type AdminReferralInput = z.input<typeof AdminReferralSchema>;
