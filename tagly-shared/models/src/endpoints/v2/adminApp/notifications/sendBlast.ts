import { z } from "zod";
import { BlastUidSchema } from "../../../../core/uids";
import {
  BlastTargetSchema,
  BlastChannelSchema,
  BlastAudienceSchema,
  BlastSenderDomainSchema,
} from "../../../../dtos/v2/adminApp/notifications/adminBlast";

/**
 * POST /v2/admin/notifications/blast — queue a one-off blast to the selected
 * audiences. The `slug` is the admin-chosen tracking identifier: it rides the
 * push payload (`admin.blast:<slug>` → the apps' `push_opened`
 * PostHog event) and the email leg's `blast` Resend tag, so per-blast opens
 * (push) and deliverability (email) are attributable. Kebab-case only — the
 * Resend tag alphabet is [A-Za-z0-9_-].
 *
 * Content is per-language: `en` is required, `cs` optional. The notifications
 * worker resolves each recipient's language and renders their variant; CS
 * recipients fall back to EN when no CS content was provided.
 */
export const BlastSlugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "kebab-case only: lowercase letters, digits, single dashes",
  );

const BlastPushContentSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
});

// No ctaUrl: an email CTA only ever opens the audience's app (see
// `renderEmailButton`).
const BlastEmailContentSchema = z.object({
  subject: z.string().min(1).max(150),
  body: z.string().min(1).max(3000),
  title: z.string().max(100).optional(),
  preheader: z.string().max(200).optional(),
  ctaLabel: z.string().max(60).optional(),
});

export const AdminSendBlastBodySchema = z
  .object({
    slug: BlastSlugSchema,
    audience: BlastAudienceSchema,
    /**
     * Sending-domain override for the email leg (see `BlastSenderDomainSchema`)
     * — re-verified against Resend at enqueue time; omitted = the default
     * marketing sender. Ignored (dropped from the payload + audit log) when
     * EMAIL is not among the channels. Regardless of audience, every blast
     * email renders as BULK mail — the marketing template with a one-click
     * unsubscribe (which opts the account out of marketing only). EVERYONE
     * blasts include it too, purely for deliverability: a mass send without
     * one converts "stop this" intent into spam reports.
     */
    senderDomain: BlastSenderDomainSchema.optional(),
    targets: z.array(BlastTargetSchema).min(1),
    channels: z.array(BlastChannelSchema).min(1),
    push: z
      .object({
        en: BlastPushContentSchema,
        cs: BlastPushContentSchema.optional(),
      })
      .optional(),
    email: z
      .object({
        en: BlastEmailContentSchema,
        cs: BlastEmailContentSchema.optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channels.includes("PUSH") && !data.push) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "push is required when PUSH channel is selected",
        path: ["push"],
      });
    }
    if (data.channels.includes("EMAIL") && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "email is required when EMAIL channel is selected",
        path: ["email"],
      });
    }
  });
export type AdminSendBlastBody = z.infer<typeof AdminSendBlastBodySchema>;

export const AdminSendBlastResponseSchema = z.object({
  message: z.string(),
  /** Null when the identical blast was already fully queued (idempotent re-run). */
  blastUid: BlastUidSchema.nullable(),
  queued: z.number().int().nonnegative(),
});
export type AdminSendBlastResponse = z.infer<
  typeof AdminSendBlastResponseSchema
>;
