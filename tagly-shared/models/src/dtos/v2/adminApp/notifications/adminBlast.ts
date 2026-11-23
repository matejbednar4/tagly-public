import { z } from "zod";
import { BlastUidSchema } from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { NotificationChannelSchema } from "../../../../core/enums";

// Blast targets are defined here (not the shared AccountTypeSchema, which
// covers live accounts only) because blasts can also reach both pending kinds.
export const BlastTargetSchema = z.enum([
  "CUSTOMER",
  "ADVERTISER",
  "PENDING_CUSTOMER",
  "PENDING_ADVERTISER",
]);
export type BlastTarget = z.infer<typeof BlastTargetSchema>;

export const BlastChannelSchema = NotificationChannelSchema.extract([
  "PUSH",
  "EMAIL",
]);
export type BlastChannel = z.infer<typeof BlastChannelSchema>;

/**
 * Which recipients a blast reaches. PROMO_OPTED_IN = explicit promo consent
 * only (the E056 strict-true rule). EVERYONE bypasses the promo opt-out and is
 * reserved for OPERATIONAL service announcements (rebrand, policy, incident)
 * on the legitimate-interest basis — never marketing content.
 */
export const BlastAudienceSchema = z.enum(["PROMO_OPTED_IN", "EVERYONE"]);
export type BlastAudience = z.infer<typeof BlastAudienceSchema>;

/**
 * Sending-domain override for the email leg: a Resend-verified domain (e.g.
 * "mail.flaer.app"). The backend re-verifies it against `resend.domains.list()`
 * before enqueueing anything and the worker sends from
 * `notifications@<domain>`; omitted = the default marketing sender. The
 * frontend lists the available domains via
 * `GET /v2/admin/notifications/sender-domains` — never free-typed.
 */
export const BlastSenderDomainSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, "must be a bare domain");

export const BlastLanguageSchema = z.enum(["en", "cs"]);
export type BlastLanguage = z.infer<typeof BlastLanguageSchema>;

/**
 * One past blast, from the permanent AdminBlastLog. `stats` is computed live
 * from the NotificationQueue rows of the blast's dedupeKey, so it decays with
 * queue retention (DONE/FAILED rows are cleaned up); once no rows remain it is
 * null and `queuedCount` is the only surviving number. `slug`/`audience` are
 * null on old rows that predate those columns.
 */
export const AdminBlastSchema = z.object({
  uid: BlastUidSchema,
  slug: z.string().nullable(),
  audience: BlastAudienceSchema.nullable(),
  /** Sending-domain override; null = default marketing sender (and old rows). */
  senderDomain: z.string().nullable(),
  /** Languages the blast carried content for (EN always; CS when provided). */
  languages: z.array(BlastLanguageSchema),
  targets: z.array(BlastTargetSchema),
  channels: z.array(BlastChannelSchema),
  pushTitle: z.string().nullable(),
  pushBody: z.string().nullable(),
  emailSubject: z.string().nullable(),
  emailBody: z.string().nullable(),
  emailTitle: z.string().nullable(),
  emailPreheader: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  queuedCount: z.number().int().nonnegative(),
  sentAt: ISODateSchema,
  stats: z
    .object({
      scheduled: z.number().int().nonnegative(),
      processing: z.number().int().nonnegative(),
      sent: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type AdminBlast = z.infer<typeof AdminBlastSchema>;
