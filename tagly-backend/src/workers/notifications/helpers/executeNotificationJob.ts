import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { notificationsWorkerTunables as T } from "../../../constants/workers/NOTIFICATIONS.js";
import { PROMO_DELIVERY } from "../../../constants/notifications/PROMO_DELIVERY.js";
import { sendEmailNotification } from "./sendEmailNotification.js";
import { sendPushNotification } from "./sendPushNotification.js";
import {
  notificationEvents,
  type AnyEventSlug,
} from "../../../constants/catalogs/notifications/notificationRegistry.js";
import { isChannelEnabledForRecipient } from "./isChannelEnabledForRecipient.js";
import {
  resolveEmail,
  resolvePushTokens,
  resolveRecipientLanguage,
  getRecipientLastSeenAt,
  getPromoSendTimezone,
  mayReceivePromo,
  isAdvertiserFunded,
} from "./recipient.js";
import {
  alreadySentPromo,
  getPromoSentAt,
  recordPromoSent,
} from "./promoNotificationLog.js";
import { promoStillRelevant } from "./promoStillRelevant.js";
import {
  promoJitterSeed,
  snapToQuietHours,
} from "../../../utils/queue/promoSendTime.js";
import {
  throttleEmailRecipient,
  throttlePushToken,
} from "./notificationThrottlers.js";
import { DeferJob } from "../../runtime/runJobQueue.js";
import { acquireEmailSendBudget } from "../../../utils/email/acquireEmailSendBudget.js";
import { captureServerEvent } from "../../../utils/core/errors/captureServerEvent.js";
import { resolveRecipientAnalyticsId } from "../../../utils/notifications/resolveRecipientAnalyticsId.js";
import type { SupportedLanguage } from "@tagly/models/shared";
import type { NotificationJob } from "./notificationJobTypes.js";

/**
 * Deliver one queued notification. A linear pipeline: validate against the
 * catalog → apply the right send-time gates → resolve language → deliver on the
 * job's channel → record the promo log.
 *
 * Promo gates, in order (all skip cleanly — a recipient doing something normal
 * is never an "error"):
 *   1. occurrence idempotency — a `PromoNotificationLog` row with
 *      `sentAt >= job.createdAt` means a prior attempt of THIS occurrence
 *      already sent it; skip. (Older rows are a previous occurrence — the
 *      inactivity steps re-arm per episode.)
 *   2. opt-out / recipient-gone re-check (`mayReceivePromo`).
 *   3. staleness — the cadence predicate is re-checked (`promoStillRelevant`)
 *      so a user who did the thing between queue and send isn't nudged for it.
 *   4. quiet-hours re-snap — backlog/retries can drift a job past its window;
 *      outside it the job is DEFERRED (returned `DeferJob`, no attempt burned)
 *      to the next snapped slot.
 *   5. (EMAIL legs) waterfall escalation — skip if the recipient opened the
 *      app after the push went out; DEFER if the push sibling hasn't gone out
 *      yet (keeps the 24h gap honest after outages instead of double-blasting
 *      from one backlog batch).
 *
 * Unfixable delivery failures throw a permanent error (`createCustomError(code,
 * msg, { permanent: true })` — the runner fails the job terminally instead of
 * retrying); expected-in-operation permanents (preference off, no tokens) add
 * `expected: true` so the tracker ignores them. Transient throws retry. Codes
 * are in the 8xxx worker-failure block. Per-target branching lives in
 * `recipient.ts` / `promoNotificationLog.ts`, not here.
 */
export async function executeNotificationJob(
  job: NotificationJob,
): Promise<true | DeferJob> {
  const slug = job.eventSlug as AnyEventSlug;

  // ---- Validate the job against the catalog (all unfixable → permanent) ----
  const catalogEvent = notificationEvents[slug];
  if (!catalogEvent) {
    throw createCustomError(8000, `Unknown event slug: ${slug}`, {
      permanent: true,
    });
  }
  if (job.target !== catalogEvent.target) {
    throw createCustomError(
      8001,
      `Event target mismatch: event=${catalogEvent.target}, job=${job.target}`,
      { permanent: true },
    );
  }
  if (!catalogEvent.availableChannels.includes(job.channel)) {
    throw createCustomError(
      8002,
      `Channel ${job.channel} not enabled for event ${slug}`,
      { permanent: true },
    );
  }

  const isPromo = catalogEvent.notificationType === "promo";
  // Admin blasts (v2 `POST /admin/notifications/blast`) bypass the promo
  // opt-out AND the transactional preference re-check — audience filtering
  // happened at queue time in the controller (see adminCatalog.ts).
  const isAdmin = catalogEvent.notificationType === "admin";
  // Pseudonymous analytics identity (uid / TARGET:id) — resolved at most once
  // per job, only when an analytics event actually fires.
  let analyticsIdMemo: string | null = null;
  const analyticsId = async () =>
    (analyticsIdMemo ??= await resolveRecipientAnalyticsId(
      job.target,
      job.recipientId,
    ));
  // Occurrence bound for promo-log reads: rows stamped at/after this job was
  // queued belong to THIS occurrence; older rows are a previous episode. The
  // 2-min allowance absorbs worker-vs-DB clock skew (`createdAt` is DB-clocked,
  // the log's refreshed `sentAt` is worker-clocked) — occurrences of a slug are
  // days apart, so the slack can never bleed into a previous episode.
  const since = new Date(job.createdAt.getTime() - 2 * 60_000);

  // ---- Send-time gates ----
  // Promo idempotency: this occurrence already went out on a prior attempt.
  if (
    isPromo &&
    (await alreadySentPromo(job.target, job.recipientId, slug, job.channel, since))
  ) {
    return true;
  }

  // Promo only: re-check the marketing opt-out in case the recipient opted out
  // (or was deleted / finished registration) after queueing. A normal user
  // action, not a failure — skip cleanly. Admin blasts are OPERATIONAL (not
  // marketing), so they bypass this gate — see adminCatalog.
  if (isPromo && !(await mayReceivePromo(job.target, job.recipientId))) {
    captureServerEvent({
      event: "promo_send_skipped",
      distinctId: await analyticsId(),
      service: "notifications",
      properties: {
        slug,
        target: job.target,
        channel: job.channel,
        reason: "opted_out_or_gone",
      },
    });
    return true;
  }

  // Add-budget sequence only: re-check the funded fact at send time. An
  // advertiser who funded (or added a PAYG card) between queue and send — the
  // escalation email leg trails the push by 24h — must never be asked to fund.
  // Skip cleanly without a log row; the scheduler excludes funded advertisers,
  // so no later step re-queues (funded is sticky).
  if (
    isPromo &&
    slug.startsWith("a.promo.add-budget.") &&
    (await isAdvertiserFunded(job.recipientId))
  ) {
    captureServerEvent({
      event: "promo_send_skipped",
      distinctId: await analyticsId(),
      service: "notifications",
      properties: {
        slug,
        target: job.target,
        channel: job.channel,
        reason: "funded",
      },
    });
    return true;
  }

  // Promo staleness: the user did the thing this nudge asks for between queue
  // and send (made their first share / came back from inactivity). Skip.
  if (isPromo && !(await promoStillRelevant(slug, job.target, job.recipientId))) {
    captureServerEvent({
      event: "promo_send_skipped",
      distinctId: await analyticsId(),
      service: "notifications",
      properties: {
        slug,
        target: job.target,
        channel: job.channel,
        reason: "stale",
      },
    });
    return true;
  }

  // Promo quiet hours: scheduledAt was snapped at queue time, but a worker
  // backlog or retry backoff can drift delivery past 20:00 local. Re-snap at
  // send time and defer (attempt-free) when outside the window. Same seed as
  // queue time → same deterministic slot.
  let promoTimeZone: string | null = null;
  if (isPromo) {
    promoTimeZone = await getPromoSendTimezone(job.target, job.recipientId);
    const now = new Date();
    const snapped = snapToQuietHours(
      now,
      promoTimeZone,
      promoJitterSeed(job.target, job.recipientId, slug, job.channel),
    );
    if (snapped.getTime() > now.getTime()) {
      return new DeferJob(snapped);
    }
  }

  // Transactional: optional defense-in-depth preference re-check at send time.
  // A disabled preference is a normal user choice → expected (fail the job
  // without tracking it as an error).
  if (!isPromo && !isAdmin && T.enforcePreferencesAtSend) {
    const channelEnabled = await isChannelEnabledForRecipient({
      target: job.target,
      recipientId: job.recipientId,
      eventSlug: slug,
      channel: job.channel,
    });
    if (!channelEnabled) {
      throw createCustomError(
        8004,
        `Channel ${job.channel} disabled via preferences for recipient ${job.recipientId}`,
        { permanent: true, expected: true },
      );
    }
  }

  // ---- Deliver ----
  const lang = await resolveRecipientLanguage(job.target, job.recipientId);
  // The channel that actually went out — normally the job's, but a promo PUSH
  // job whose tokens vanished falls through to the step's email (below).
  let deliveredChannel = job.channel;

  if (job.channel === "EMAIL") {
    // Waterfall escalation check: on two-channel promo steps the email leg is
    // queued ESCALATION_DELAY_MS behind the push (see
    // queuePromoNotificationJobsOrReturn). A PUSH log row for this occurrence
    // means this email IS that trailing leg — skip it when the recipient
    // opened the app after the push went out (the push worked; the email
    // would just nag), and record the skip for the funnel.
    if (isPromo) {
      const pushSentAt = await getPromoSentAt(
        job.target,
        job.recipientId,
        slug,
        "PUSH",
        since,
      );
      if (pushSentAt) {
        const lastSeenAt = await getRecipientLastSeenAt(
          job.target,
          job.recipientId,
        );
        if (lastSeenAt && lastSeenAt > pushSentAt) {
          captureServerEvent({
            event: "promo_escalation_skipped",
            distinctId: await analyticsId(),
            service: "notifications",
            properties: { slug, target: job.target },
          });
          // The step already counts as done via the PUSH log row — no EMAIL
          // log is written (nothing was sent).
          return true;
        }
      } else if (catalogEvent.availableChannels.includes("PUSH")) {
        // The push leg hasn't gone out for this occurrence. If it's still
        // pending (backlog, retries), WAIT for it — sending the email now
        // would fire both channels near-simultaneously (e.g. a >24h outage
        // makes both legs due in the same claimed batch) and would rob the
        // recipient of the open-the-app grace window. Re-anchor to the push's
        // schedule + the escalation gap. If the push leg is gone (failed
        // terminally / pruned), the email proceeds as the fallback channel.
        const pushSibling = await prisma.notificationQueue.findFirst({
          where: {
            target: job.target,
            recipientId: job.recipientId,
            eventSlug: job.eventSlug,
            channel: "PUSH",
            status: { in: ["SCHEDULED", "PROCESSING"] },
          },
          select: { scheduledAt: true },
        });
        if (pushSibling) {
          const anchor = Math.max(
            Date.now(),
            pushSibling.scheduledAt.getTime(),
          );
          return new DeferJob(
            snapToQuietHours(
              new Date(anchor + PROMO_DELIVERY.ESCALATION_DELAY_MS),
              promoTimeZone ?? "UTC",
              promoJitterSeed(job.target, job.recipientId, slug, "EMAIL"),
            ),
          );
        }
      }
    }
    await deliverEmail(job, slug, lang, await analyticsId());
  } else if (job.channel === "PUSH") {
    const tokens = await resolvePushTokens(job.target, job.recipientId);
    if (tokens.length === 0) {
      // Promo safety net: the tokens died between queue and send (uninstall,
      // permission reported off). Fall through to the step's email leg
      // instead of failing the step terminally — unless that leg already
      // went out for this occurrence (or is what this recipient got queued
      // for anyway).
      if (
        isPromo &&
        catalogEvent.availableChannels.includes("EMAIL") &&
        !(await alreadySentPromo(
          job.target,
          job.recipientId,
          slug,
          "EMAIL",
          since,
        ))
      ) {
        await deliverEmail(job, slug, lang, await analyticsId());
        deliveredChannel = "EMAIL";
      } else if (isPromo) {
        // Nothing left to deliver on this job; the email leg (sent or queued)
        // owns the step. Complete without logging a phantom PUSH send.
        return true;
      } else {
        // Transactional with no reachable device — common (uninstall,
        // permission off), so expected: fail without tracking as an error.
        throw createCustomError(
          8007,
          `No active push tokens for ${job.target} ${job.recipientId}`,
          { permanent: true, expected: true },
        );
      }
    } else {
      await deliverPush(job, slug, lang, tokens);
    }
  } else {
    throw createCustomError(8005, `Unsupported channel: ${job.channel}`, {
      permanent: true,
    });
  }

  // Record the promo send so the schedulers skip this recipient next run.
  if (isPromo) {
    await recordPromoSent(job.target, job.recipientId, slug, deliveredChannel);
    // Send-side funnel event — pairs with the clients' `push_opened` for
    // per-step open rates (and the `promo_escalation_skipped` above).
    captureServerEvent({
      event: "promo_notification_sent",
      distinctId: await analyticsId(),
      service: "notifications",
      properties: { slug, channel: deliveredChannel, target: job.target },
    });
  }

  return true;
}

/** Deliver an EMAIL job: resolve address, throttle, send (the sender owns the
 *  unsubscribe footer). The queue row id doubles as the Resend idempotency key
 *  so a retry after a sent-but-errored attempt can't double-deliver. */
async function deliverEmail(
  job: NotificationJob,
  slug: AnyEventSlug,
  lang: SupportedLanguage,
  analyticsId: string,
) {
  const to =
    job.overwriteEmail ?? (await resolveEmail(job.target, job.recipientId));
  if (!to) {
    throw createCustomError(
      8006,
      `Missing or unverified email for ${job.target} ${job.recipientId}`,
      { permanent: true },
    );
  }
  await throttleEmailRecipient(`EMAIL:${to}`);
  // Global cross-process budget below the Resend ACCOUNT rate limit, so a
  // worker blast can never 429 the inline OTP mail sharing the account
  // (E057). Fail-open; waits are bounded well under jobTimeoutMs.
  await acquireEmailSendBudget();

  await sendEmailNotification({
    to,
    target: job.target,
    recipientId: job.recipientId,
    analyticsId,
    eventSlug: slug,
    payload: job.payload,
    lang,
    idempotencyKey: `notif-job-${job.id}`,
  });
}

/** Deliver a PUSH job to already-resolved tokens: throttle each, send. Token
 *  resolution lives in the orchestrator so the promo waterfall can fall
 *  through to email when there are none. */
async function deliverPush(
  job: NotificationJob,
  slug: AnyEventSlug,
  lang: SupportedLanguage,
  tokens: string[],
) {
  if (T.push.throttlePerToken) {
    await Promise.all(tokens.map((t) => throttlePushToken(`PUSH:${t}`)));
  }
  await sendPushNotification({
    pushTokens: tokens,
    eventSlug: slug,
    payload: job.payload,
    lang,
  });
}
