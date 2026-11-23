import { callAuthed } from "@tagly/client";
import { useQuery } from "@tanstack/react-query";
import { getIgStories } from "@tagly/sdk/v2/customerApp";
import type { InstagramStory } from "@tagly/models/shared";
import type { Router } from "expo-router";

/** A single live Instagram story (the share-create grid item). */
export type IgStory = InstagramStory;

/**
 * Query key for the live Instagram stories cache (the share-create grid).
 * Exported so callers can surgically update it without a refetch — e.g. drop a
 * story from the grid the moment it's monetized so it can't be picked twice.
 */
export const IG_STORIES_QUERY_KEY = ["igStories"] as const;

/**
 * The logged-in customer's live Instagram stories
 * (`GET /v2/customers/me/instagram/stories`) — the pickable media for a new
 * share. Already-shared stories are filtered server side.
 *
 * Not ETag-cached: stories are inherently volatile (24h lifespan, and the user
 * may post a fresh one mid-session), so this uses a plain query with a short
 * `staleTime` and exposes a manual refetch for pull-to-refresh.
 *
 * Pass `enabled: false` to skip the fetch entirely (e.g. while Instagram is
 * disconnected — the endpoint would just error on a missing/expired token).
 */
export function useIgStories(router: Router, options?: { enabled?: boolean }) {
  return useQuery<IgStory[]>({
    queryKey: IG_STORIES_QUERY_KEY,
    queryFn: async (): Promise<IgStory[]> => {
      // suppressAlerts: the picker renders its own inline error state off the
      // query's isError — a central alert on top of it would double-surface.
      // (The wrapper's 401 sign-out and update-required gates still apply.)
      const res = await callAuthed(router, (jwt) => getIgStories({ jwt }), {
        suppressAlerts: true,
      });
      if (!res.ok || !res.data) {
        throw new Error("Failed to load Instagram stories");
      }
      return res.data.stories;
    },
    enabled: options?.enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
