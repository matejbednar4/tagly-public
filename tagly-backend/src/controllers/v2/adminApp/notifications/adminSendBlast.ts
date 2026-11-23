/**
 * Queues a one-off notification blast to the selected audiences, then writes a
 * permanent AdminBlastLog record for auditing (`POST /v2/admin/notifications/blast`).
 *
 * For each selected target (CUSTOMER, ADVERTISER, PENDING_CUSTOMER,
 * PENDING_ADVERTISER):
 *   1. Fetches recipients by audience mode — `PROMO_OPTED_IN` requires the
 *      explicit consent `promoNotificationsEnabled === true` (the E056
 *      strict-true rule; pendings' nullable flag never passes on null),
 *      `EVERYONE` takes all rows (operational/legitimate-interest sends only —
 *      see adminCatalog.ts for the legal boundary).
 *   2. For PUSH: filters to recipients with at least one active push token.
 *      @shutdown: in production, EMAIL on the CUSTOMER target goes only to
 *      customers with at least one share or a balance above 0 — the ones who
 *      can be owed money (see `fetchShutdownEmailIds`). Push stays unfiltered.
 *      For EMAIL on the two PENDING targets: filters to VERIFIED emails only —
 *      an unverified pending row can hold a mistyped address its owner never
 *      proved. The worker's `resolveEmail` re-checks at send time (defense in
 *      depth); this queue-time filter is what keeps such rows out of the queue
 *      and the queued count honest.
 *   3. Bulk-inserts NotificationQueue rows for each (recipient, channel) pair.
 *
 * The payload carries the PER-LANGUAGE content (`push`/`email` each as
 * `{ en, cs? }` — the worker renders each recipient's language, CS falling
 * back to EN), the `blastSlug` (threaded into the push payload slug
 * `admin.blast:<blastSlug>` → the apps' `push_opened` PostHog event,
 * and the email `blast` Resend tag), the `audience` (queue-time filter +
 * audit record ONLY — regardless of audience, every blast email renders as
 * BULK mail: marketing template + one-click unsubscribe, which opts the
 * account out of marketing; see `sendEmailNotification`), and the optional
 * `senderDomain` override (From = `notifications@<domain>`, VERIFIED against
 * `resend.domains.list()` here before anything is queued — an unverified
 * domain would have every send rejected downstream). The override is
 * email-only: it is dropped from the payload AND the audit log when EMAIL is
 * not among the channels, so a push-only blast can never record a phantom
 * sender.
 *
 * Queue dedupeKey = SHA-256 of the blast definition (slug, audience, targets,
 * channels, content — deliberately NOT the sender domain, which doesn't
 * change what a recipient receives). The queue's unique constraint
 * (target, recipientId, eventSlug, channel, dedupeKey) means a recipient can't
 * be queued twice for the same blast — re-running the identical blast queues
 * only recipients not covered before (e.g. users who signed up since the first
 * run) and an unchanged re-run returns queued: 0.
 *
 * AdminBlastLog.dedupeKey = the same SHA-256, so an idempotent re-run skips
 * creating a duplicate log entry (P2002 swallowed) and returns blastUid: null.
 * The flat columns hold the EN content for quick scanning; `content` holds
 * the full per-language record.
 */

import type { RequestHandler } from "express";
import { createHash } from "crypto";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { generateUid } from "../../../../utils/core/uids/generateUid.js";
import { getVerifiedResendDomainsOrThrow } from "../../../../utils/notifications/getVerifiedResendDomainsOrThrow.js";
import prisma from "../../../../prisma/prisma.js";
import { envVariables } from "../../../../environment/envVariables.js";
import type {
  AdminSendBlastBody,
  AdminSendBlastResponse,
  BlastTarget,
} from "@tagly/models/v2/adminApp";
import { Prisma } from "../../../../generated/prisma/client.js";

const EVENT_SLUG_BY_TARGET = {
  CUSTOMER: "admin.blast.customer",
  ADVERTISER: "admin.blast.advertiser",
  PENDING_CUSTOMER: "admin.blast.pending_customer",
  PENDING_ADVERTISER: "admin.blast.pending_advertiser",
} as const satisfies Record<BlastTarget, string>;

export const adminSendBlast: RequestHandler = asyncHandler(async (req, res) => {
  const {
    slug,
    audience,
    senderDomain: rawSenderDomain,
    targets,
    channels,
    push,
    email,
  } = req.validatedBody as AdminSendBlastBody;

  const adminId = req.user.id;

  // The sender override only means anything for the email leg — normalize it
  // away for push-only blasts so the queue payload and the audit log can never
  // record a phantom sender (the compose UI keeps the picked domain in state
  // even after EMAIL is deselected).
  const senderDomain = channels.includes("EMAIL") ? rawSenderDomain : undefined;

  // A sender override must be a domain Resend can actually send from —
  // checked BEFORE any rows are queued, so a typo'd/unverified domain can
  // never produce a blast whose every email bounces at the API.
  if (senderDomain) {
    const verified = await getVerifiedResendDomainsOrThrow();
    if (!verified.includes(senderDomain)) {
      throw createCustomError(
        5784,
        `Sender domain ${senderDomain} is not verified in Resend`,
        400,
      );
    }
  }

  // Deterministic per blast definition — same message to same audience = same
  // key. Sorted so selection order doesn't affect the hash; the sender domain
  // is deliberately excluded (it doesn't change what a recipient receives).
  const dedupeKey = createHash("sha256")
    .update(
      JSON.stringify({
        slug,
        audience,
        targets: [...targets].sort(),
        channels: [...channels].sort(),
        push,
        email,
      }),
    )
    .digest("hex");

  const now = new Date();
  const rows: Prisma.NotificationQueueCreateManyInput[] = [];

  const payload = {
    blastSlug: slug,
    audience,
    senderDomain,
    push,
    email,
  };

  const promoOnly = audience === "PROMO_OPTED_IN";

  for (const target of targets) {
    const recipientIds = await fetchAudienceIds(target, promoOnly);
    if (recipientIds.length === 0) continue;

    const pushRecipientSet = channels.includes("PUSH")
      ? await fetchPushTokenHolders(target)
      : new Set<number>();

    // The EMAIL leg for PENDING targets is verified-addresses only: until the
    // OTP step a pending row can hold a mistyped address its owner never
    // proved, and mass-mailing those is a spam-report generator. The worker's
    // `resolveEmail` re-checks at send time, but this queue-time filter is the
    // primary gate — it keeps the rows out of the queue entirely (and the
    // response's queued count honest). Full accounts verified their email at
    // registration by construction (`fetchVerifiedEmailIds` returns null =
    // no filter).
    const verifiedEmailSet = channels.includes("EMAIL")
      ? await fetchVerifiedEmailIds(target)
      : null;

    // @shutdown: email only customers who can be owed money (prod only).
    const shutdownEmailSet = channels.includes("EMAIL")
      ? await fetchShutdownEmailIds(target)
      : null;

    for (const recipientId of recipientIds) {
      for (const channel of channels) {
        if (channel === "PUSH" && !pushRecipientSet.has(recipientId)) continue;
        if (
          channel === "EMAIL" &&
          verifiedEmailSet &&
          !verifiedEmailSet.has(recipientId)
        )
          continue;
        if (
          channel === "EMAIL" &&
          shutdownEmailSet &&
          !shutdownEmailSet.has(recipientId)
        )
          continue; // @shutdown
        rows.push({
          target,
          recipientId,
          eventSlug: EVENT_SLUG_BY_TARGET[target],
          channel,
          payload,
          scheduledAt: now,
          dedupeKey,
          status: "SCHEDULED",
          attempts: 0,
          lastError: null,
        });
      }
    }
  }

  if (rows.length === 0) {
    res.status(200).json({
      message: "No eligible recipients found",
      blastUid: null,
      queued: 0,
    } satisfies AdminSendBlastResponse);
    return;
  }

  // Insert in chunks to avoid a single massive transaction on large blasts.
  const CHUNK_SIZE = 500;
  let queuedCount = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const result = await prisma.notificationQueue.createMany({
      data: rows.slice(i, i + CHUNK_SIZE),
      skipDuplicates: true,
    });
    queuedCount += result.count;
  }

  let blastUid: string | null = generateUid("BLAST");
  try {
    await prisma.adminBlastLog.create({
      data: {
        uid: blastUid,
        adminId,
        slug,
        audience,
        senderDomain,
        targets,
        channels,
        // Flat EN columns for quick scanning; `content` is the full record.
        pushTitle: push?.en.title,
        pushBody: push?.en.body,
        emailSubject: email?.en.subject,
        emailBody: email?.en.body,
        emailTitle: email?.en.title,
        emailPreheader: email?.en.preheader,
        ctaLabel: email?.en.ctaLabel,
        content: { push, email } as Prisma.InputJsonValue,
        queuedCount,
        dedupeKey,
      },
    });
  } catch (e) {
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
    )
      throw e;
    // Same blast definition already logged — idempotent re-run, skip.
    blastUid = null;
  }

  res.status(200).json({
    message: "Blast queued successfully",
    blastUid,
    queued: queuedCount,
  } satisfies AdminSendBlastResponse);
});

/** Recipient ids for a target, filtered to explicit promo consent when
 *  `promoOnly` (strict `=== true` — E056: null is never consent). */
async function fetchAudienceIds(
  target: BlastTarget,
  promoOnly: boolean,
): Promise<number[]> {
  const where = promoOnly ? { promoNotificationsEnabled: true } : {};
  const select = { id: true } as const;

  const rows =
    target === "CUSTOMER"
      ? await prisma.customer.findMany({ where, select })
      : target === "ADVERTISER"
        ? await prisma.advertiser.findMany({ where, select })
        : target === "PENDING_CUSTOMER"
          ? await prisma.pendingCustomer.findMany({ where, select })
          : await prisma.pendingAdvertiserAccount.findMany({ where, select });
  return rows.map((r) => r.id);
}

/** For the two PENDING targets: ids whose email the owner actually verified
 *  (OTP). Returns null for full accounts — their email was verified at
 *  registration, so no filter applies. Same intersect-in-the-row-loop shape
 *  as `fetchPushTokenHolders`. */
async function fetchVerifiedEmailIds(
  target: BlastTarget,
): Promise<Set<number> | null> {
  if (target === "PENDING_CUSTOMER") {
    const rows = await prisma.pendingCustomer.findMany({
      where: { emailVerified: true },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
  if (target === "PENDING_ADVERTISER") {
    const rows = await prisma.pendingAdvertiserAccount.findMany({
      where: { emailVerified: true },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
  return null;
}

/**
 * @shutdown (2026-10 wind-down) — for the CUSTOMER target in production: ids
 * of customers with at least one share (any status) or a balance above 0, i.e.
 * everyone who can be owed money (the balance clause catches referral-only
 * earners). Saves the shutdown email from going to customers who never earned.
 * Returns null (no filter) for every other target and outside production. Same
 * intersect-in-the-row-loop shape as `fetchVerifiedEmailIds`.
 */
async function fetchShutdownEmailIds(
  target: BlastTarget,
): Promise<Set<number> | null> {
  if (envVariables.APP_STAGE !== "production" || target !== "CUSTOMER") {
    return null;
  }
  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { shares: { some: {} } },
        { sensitiveData: { balanceUsdCents: { gt: 0n } } },
      ],
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Ids (of the target type) holding at least one active push token. The
 *  audience filter is applied by intersecting with `fetchAudienceIds` in the
 *  row loop, so this is deliberately consent-agnostic. */
async function fetchPushTokenHolders(
  target: BlastTarget,
): Promise<Set<number>> {
  if (target === "CUSTOMER") {
    const tokens = await prisma.pushToken.findMany({
      where: { customerId: { not: null }, disabledAt: null },
      select: { customerId: true },
    });
    return new Set(
      tokens
        .map((t) => t.customerId)
        .filter((id): id is number => id !== null),
    );
  }
  if (target === "ADVERTISER") {
    const tokens = await prisma.pushToken.findMany({
      where: { advertiserId: { not: null }, disabledAt: null },
      select: { advertiserId: true },
    });
    return new Set(
      tokens
        .map((t) => t.advertiserId)
        .filter((id): id is number => id !== null),
    );
  }
  if (target === "PENDING_CUSTOMER") {
    const tokens = await prisma.pushToken.findMany({
      where: { pendingCustomerId: { not: null }, disabledAt: null },
      select: { pendingCustomerId: true },
    });
    return new Set(
      tokens
        .map((t) => t.pendingCustomerId)
        .filter((id): id is number => id !== null),
    );
  }
  const tokens = await prisma.pushToken.findMany({
    where: { pendingAdvertiserId: { not: null }, disabledAt: null },
    select: { pendingAdvertiserId: true },
  });
  return new Set(
    tokens
      .map((t) => t.pendingAdvertiserId)
      .filter((id): id is number => id !== null),
  );
}
