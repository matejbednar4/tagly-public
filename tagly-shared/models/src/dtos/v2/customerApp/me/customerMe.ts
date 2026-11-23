import { z } from "zod";
import { CustomerUidSchema } from "../../../../core/uids";
import { EmailSchema } from "../../../../core/email";
import { SupportedLocaleSchema } from "../../../../core/locale";
import { GenderSchema, CustomerStatusSchema } from "../../../../core/enums";
import { ISODateSchema } from "../../../../core/time";
import { CustomerSensitiveDataSchema } from "./customerSensitiveData";
import { CustomerInstagramAccountSchema } from "./customerInstagram";
import { InterestInListSchema } from "../../crossApp/common/interest";

/**
 * `CustomerMe` — the lean, always-needed core of the logged-in customer,
 * returned by `GET /v2/customers/me`. v2 wire: no deprecated shims, and no
 * embedded preview lists. The bulkier, independently-cacheable slices live on
 * their own sub-resources (`/me/statistics`, `/me/referrals`, plus the shares /
 * ledger / withdrawals endpoints) so `/me` stays cheap to fetch on every app
 * open and each slice can be cached on its own cadence.
 */
export const CustomerMeSchema = z.object({
  uid: CustomerUidSchema,
  fullName: z.string(),
  email: EmailSchema,
  /**
   * ISO alpha-2 country code set at registration (`US`, `CZ`). Drives EU-only
   * UX gates (consent toggles). Not user-modifiable.
   */
  locale: SupportedLocaleSchema,
  gender: GenderSchema,
  /** When gender was last changed (gates the change-cooldown), or null. */
  genderUpdatedAt: ISODateSchema.nullable(),
  /** Self-reported "typical story views" (reach fallback for no-IG estimates),
   *  server-owned (E062). Null = never provided. The app hydrates its local
   *  story-views state from this so the value follows the account. */
  estimatedStoryViews: z.number().int().positive().nullable(),
  createdAt: ISODateSchema,
  /**
   * Account moderation status. A `BANNED` customer can still log in and browse,
   * but the backend blocks value-bearing actions (creating shares, withdrawing).
   * Drives the in-app banned surface (account hero + drawer).
   */
  status: CustomerStatusSchema,
  /**
   * Admin-provided reason for the ban, surfaced in the banned UI. Non-null only
   * when `status === "BANNED"` and a reason was recorded on the IG ban-list; may
   * still be null when banned (no reason given / no linked IG). Always null for
   * `ACTIVE` accounts.
   */
  banReason: z.string().nullable(),
  /**
   * Marketing-consent flag: whether the customer opted in to promotional /
   * re-engagement notifications (email + push, gated together). Drives the
   * "Promotions & reminders" settings toggle (the Apple 4.5.4-required in-app
   * opt-out). Transactional notifications are unaffected by this.
   */
  promoNotificationsEnabled: z.boolean(),
  sensitiveData: CustomerSensitiveDataSchema,
  /** The linked Instagram account, or null if the customer hasn't connected one. */
  instagram: CustomerInstagramAccountSchema.nullable(),
  interests: z.array(InterestInListSchema).max(3),
  /** When interests were last changed (gates the change-cooldown), or null. */
  interestsUpdatedAt: ISODateSchema.nullable(),
  /**
   * When the referral code was last changed (gates the change-cooldown in
   * settings), or null. The code itself + referral stats live on
   * `GET /me/referrals`.
   */
  referralCodeUpdatedAt: ISODateSchema.nullable(),
  shouldAgreeWithLatestTos: z.boolean(),
  shouldAgreeWithLatestPrivacyPolicy: z.boolean(),
});

/** Raw hydrator shape (accepts `Date` / `BigInt` before the schema coerces). */
export type CustomerMeInput = z.input<typeof CustomerMeSchema>;
export type CustomerMe = z.infer<typeof CustomerMeSchema>;
