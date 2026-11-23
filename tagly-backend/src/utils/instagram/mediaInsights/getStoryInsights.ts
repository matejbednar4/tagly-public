import prisma from "../../../prisma/prisma.js";
import { insightsWorkerTunables as T } from "../../../constants/workers/IG_INSIGHTS.js";
import { fetchWithTimeout } from "../../core/http/fetchWithTimeout.js";
import { throwForBadResponse } from "./helpers/throwForBadResponse.js";

// Pull a simple IG insights metric's scalar value out of the `data` array by name.
const take = (arr: any[], name: string) =>
  arr.find((d) => d?.name === name)?.values?.[0]?.value ?? null;

export async function getStoryInsights({
  shareId,
  igPostId,
  igAccessToken,
}: {
  shareId: number;
  igPostId: string;
  igAccessToken: string;
}) {
  const url =
    `https://graph.instagram.com/${encodeURIComponent(igPostId)}` +
    `/insights?metric=follows,navigation,profile_activity,profile_visits,reach,replies,shares,total_interactions,views` +
    `&access_token=${encodeURIComponent(igAccessToken)}`;

  const res = await fetchWithTimeout(url, T.httpTimeoutMs, { redirect: "follow" });
  if (!res.ok) await throwForBadResponse("IG STORY insights", res);

  const buf = await res.arrayBuffer();
  if (buf.byteLength > T.maxBodySizeBytes)
    throw new Error(`Payload too large (${buf.byteLength})`);
  const json = JSON.parse(new TextDecoder().decode(buf));
  const data: any[] = Array.isArray(json?.data) ? json.data : [];

  // simple metrics
  const follows = take(data, "follows");
  const profileVisits = take(data, "profile_visits");
  const reach = take(data, "reach");
  const replies = take(data, "replies");
  const shares = take(data, "shares");
  const totalInteractions = take(data, "total_interactions");
  const views = take(data, "views");

  // composites
  const nav =
    data.find((d) => d?.name === "navigation")?.values?.[0]?.value ?? {};
  const tapsForward =
    typeof nav.taps_forward === "number" ? nav.taps_forward : null;
  const tapsBack = typeof nav.taps_back === "number" ? nav.taps_back : null;
  const exits = typeof nav.exits === "number" ? nav.exits : null;

  // A payload with NEITHER reach nor views is not a result — it's a suppressed
  // metric, an API-shape drift, or an empty 200. Persisting it would satisfy
  // the payment worker's existence gate (`insights: { isNot: null }`) and the
  // pricer's `reach ?? 0` would settle the share as a terminal PAID at $0 —
  // silent customer underpayment with no recovery path. Throw retryable
  // instead: a transient empty payload gets the normal backoff retries, a
  // persistent one fails the job terminally into the void path (share
  // UNPAYABLE + budget unlocked — honest and visible). A genuine `reach: 0`
  // (story nobody saw) is a NUMBER, passes this guard, and still prices to a
  // legitimate $0.
  if (reach === null && views === null) {
    throw new Error(
      `IG STORY insights: payload carried neither reach nor views (${data.length} metrics present) — refusing to persist an unpriceable row`,
    );
  }

  await prisma.shareInsights.upsert({
    where: { shareId },
    create: {
      shareId,
      follows,
      profileVisits,
      reach,
      replies,
      shares,
      totalInteractions,
      views,
      tapsForward,
      tapsBack,
      exits,
      fetchedAt: new Date(),
    },
    update: {
      follows,
      profileVisits,
      reach,
      replies,
      shares,
      totalInteractions,
      views,
      tapsForward,
      tapsBack,
      exits,
      fetchedAt: new Date(),
    },
  });
}
