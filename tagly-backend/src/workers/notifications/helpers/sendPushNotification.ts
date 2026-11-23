import prisma from "../../../prisma/prisma.js";
import { notificationsWorkerTunables as T } from "../../../constants/workers/NOTIFICATIONS.js";
import { throwForBadResponse } from "../../../utils/instagram/mediaInsights/helpers/throwForBadResponse.js";
import {
  AnyEventSlug,
  pickEventTemplate,
} from "../../../constants/catalogs/notifications/notificationRegistry.js";
import { PUSH_NOTIFICATIONS } from "../../../constants/integrations/EXPO_PUSH.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { SupportedLanguage } from "@tagly/models/shared";
import { workerLogger } from "../../runtime/workerLogger.js";

const log = workerLogger("notifications");

/** AbortSignal that fires after `ms`, with a `clear()` to cancel the timer. */
function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}


type PushNotificationParams = {
  pushTokens: string[];
  eventSlug: AnyEventSlug;
  payload: Prisma.JsonValue | null;
  /** Recipient's resolved language. The send pipeline resolves this once
   *  per job via resolveRecipientLanguage and threads it down. */
  lang: SupportedLanguage;
};

export async function sendPushNotification({
  pushTokens,
  eventSlug,
  payload,
  lang,
}: PushNotificationParams) {
  if (!pushTokens?.length) return;

  const tpl = pickEventTemplate(eventSlug, lang).push;
  const rawTitle = tpl?.title;
  const title = typeof rawTitle === "function" ? rawTitle(payload) : rawTitle;
  const bodyStr = tpl?.body ? tpl.body(payload) : undefined;
  const extraData = tpl?.data ? tpl.data(payload) : {};

  const batches = chunk(pushTokens, PUSH_NOTIFICATIONS.MAX_BATCH_SIZE);
  let acceptedCount = 0;

  for (const batch of batches) {
    const messages = batch.map((token) => {
      const base: any = {
        to: token,
        sound: "default",
        data: {
          slug: eventSlug,
          ...extraData,
        },
      };
      if (title) base.title = title;
      if (bodyStr) base.body = bodyStr;
      return base;
    });

    // withTimeout just like IG helpers
    const httpTimeout = T.httpTimeoutMs ?? 8000;
    const { signal, clear } = withTimeout(httpTimeout);
    try {
      const res = await fetch(PUSH_NOTIFICATIONS.EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
        signal,
      });

      if (!res.ok) {
        await throwForBadResponse("Expo push send", res);
      }

      // Read as ArrayBuffer (size-guard, mirror IG approach)
      const buf = await res.arrayBuffer();
      const maxBytes = T.maxBodySizeBytes ?? 256 * 1024;
      if (buf.byteLength > maxBytes) {
        throw new Error(`Payload too large (${buf.byteLength} bytes)`);
      }

      const json = JSON.parse(new TextDecoder().decode(buf));
      acceptedCount += await handleExpoResponse(json, batch);
    } finally {
      clear();
    }
  }

  // Every ticket errored → nothing was handed to a device. Don't let the job
  // count as a successful send (it would write a PUSH promo-log row for a
  // delivery that never happened and mute the email waterfall). Throwing
  // transient retries the job; if the failures were DeviceNotRegistered the
  // tokens are now disabled, so the retry resolves no tokens and the promo
  // path falls through to the email leg.
  if (acceptedCount === 0) {
    throw new Error(
      `Expo accepted 0 of ${pushTokens.length} push messages for ${eventSlug}`,
    );
  }
}

/** Parse Expo tickets; disable tokens that are no longer valid. Returns how
 *  many tickets Expo accepted (`status: "ok"`). */
async function handleExpoResponse(
  json: any,
  batch: string[],
): Promise<number> {
  // Expo returns { data: [{ status, id?, message?, details? }, ...], errors? }
  const tickets: any[] = Array.isArray(json?.data) ? json.data : [];

  if (tickets.length !== batch.length) {
    // Not fatal, but worth a structured line for observability.
    log.warn("push ticket count mismatch", {
      got: tickets.length,
      expected: batch.length,
    });
  }

  const toDisable: string[] = [];
  let okCount = 0;

  tickets.forEach((ticket, i) => {
    const token = batch[i];
    if (ticket && ticket.status === "ok") {
      okCount++;
      return;
    }
    if (!ticket) return;

    const msg = ticket.message || "Unknown push error";
    const details = ticket.details || {};

    // Permanent token errors → mark disabled
    // https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets-and-errors
    if (details.error === "DeviceNotRegistered") {
      toDisable.push(token);
      // Optional: minimal log; we handle DB disable below
      return;
    }

    // Non-device errors: log; treat as transient at the request level (we don't throw here)
    // Examples: "MessageTooBig", "MessageRateExceeded", "InvalidCredentials", etc.
    // Stays a structured stderr line (not tracked) — these are noisy per-token
    // transients, not something to page on.
    log.error("expo push error", { token, msg, details });
  });

  if (toDisable.length > 0) {
    await disablePushTokens(toDisable);
  }

  return okCount;
}

/** Disable any matching PushToken rows (idempotent). */
async function disablePushTokens(tokens: string[]) {
  await prisma.pushToken.updateMany({
    where: { token: { in: tokens }, disabledAt: null },
    data: { disabledAt: new Date() },
  });
}

/** Chunk array into groups of n elements */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
