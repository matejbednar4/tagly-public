import prisma from "../../../prisma/prisma.js";
import { getDecryptedInstagramTokenForCustomer } from "../tokens/getDecryptedIgTokenForCustomer.js";
import { getStoriesFromInstagram } from "./getStoriesFromInstagram.js";
import { captureServerEvent } from "../../core/errors/captureServerEvent.js";
import { isInstagramStoryShareable } from "@tagly/models/shared";
import type { InstagramStory } from "@tagly/models/shared";

/**
 * The customer's currently-live Instagram stories that are still **eligible for a
 * new share** — i.e. the live list minus any story that already has (or ever
 * had) a share, per the `monetized_instagram_posts` registry, so a picker can
 * never re-offer a monetized one.
 *
 * Stories whose media Instagram withholds ARE included, with `mediaUrl: null`:
 * the Graph API drops `media_url` for copyright-flagged content (typically a
 * music sticker on the story). The picker shows them as a "copyrighted music"
 * placeholder so the customer learns why the story can't be monetized, instead
 * of wondering where it went — but they are not shareable (`createShare` rejects
 * them with 4107; clients gate on `isInstagramStoryShareable`). Callers that
 * need only monetizable candidates (the app-open nudge's Rekognition match)
 * must filter with the same predicate.
 *
 * This is the wrapper the story *pickers* use (the share-create grid and the
 * app-open nudge). The raw `getStoriesFromInstagram` stays unfiltered on purpose:
 * `createShare` looks up the one selected story by id and must find it among all
 * live stories (duplicate protection there is a distinct concern with its own
 * error path) — filtering there would surface the wrong "not live/owned" error.
 *
 * Throws like its dependencies: token-state codes (5007/5008/5009/5110) if the IG
 * link is missing/expired, or 2008 on a Graph fetch failure. A best-effort caller
 * that would rather degrade than surface those should wrap the call.
 */
export async function getUnsharedLiveStories(
  customerId: number
): Promise<InstagramStory[]> {
  const { accessToken, instagramUid } =
    await getDecryptedInstagramTokenForCustomer(customerId);

  const rawStories = await getStoriesFromInstagram(accessToken, instagramUid);

  // The raw fetch maps a withheld `media_url` to "" — normalize to an explicit
  // `null` so the response satisfies `InstagramStorySchema` (`z.url().nullable()`).
  // The key must stay present (never omitted): shipped clients declare it, and
  // the wire rule is "null a stopped field, don't delete it".
  const stories: InstagramStory[] = rawStories.map((s) => ({
    ...s,
    mediaUrl: s.mediaUrl || null,
  }));

  // Measure how often Instagram withholds story media (suspected mid-2026
  // enforcement change — users report music stories stopped monetizing ~Aug
  // 2026). Low-volume: fires only when a live story is actually affected.
  // Pseudonymous per the captureServerEvent contract (customer uid, no PII).
  const withheldCount = stories.filter(
    (s) => !isInstagramStoryShareable(s),
  ).length;
  if (withheldCount > 0) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { uid: true },
    });
    if (customer) {
      captureServerEvent({
        event: "ig_story_media_withheld",
        distinctId: customer.uid,
        service: "api",
        properties: {
          withheldCount,
          liveStoryCount: stories.length,
          withheldNoMediaUrl: stories.filter((s) => !s.mediaUrl).length,
        },
      });
    }
  }

  // Dedup reads `monetized_instagram_posts` — the append-only single source of
  // "this story already has (or ever had) a share" (E074), the same registry
  // createShare's in-tx insert enforces. A story is monetizable once, EVER:
  // rejected/voided shares' ids stay registered (Matej, 2026-08-02 — the old
  // "a voided share's story reappears" behavior was wrong), and the registry
  // survives GDPR erasure nulling `Share.igPostId`, so an erased-then-
  // reconnected account is never re-offered an already-monetized story.
  if (stories.length === 0) return [];
  const monetized = await prisma.monetizedInstagramPost.findMany({
    where: { igPostId: { in: stories.map((s) => s.id) } },
    select: { igPostId: true },
  });
  const alreadySharedIds = new Set(monetized.map((m) => m.igPostId));

  return stories.filter((s) => !alreadySharedIds.has(s.id));
}
