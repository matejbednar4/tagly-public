import {
  IG_HTTP_TIMEOUT_MS,
  LIMIT_IG_STORY_FETCH,
} from "../../../constants/instagram/INSTAGRAM.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";

/**
 * Fetch the user's active Instagram stories from the Instagram Graph API.
 *
 * Canonical permanent util. The snake→camel mapping is inlined rather than
 * routed through a generic helper — the shape is fixed and tiny.
 *
 * Throws 2008 on any HTTP / network / shape error.
 */
export const getStoriesFromInstagram = async (
  accessToken: string,
  instagramUid: string,
  opts?: { limit: number }
): Promise<
  {
    id: string;
    mediaType: "IMAGE" | "VIDEO";
    igPostType: "STORY";
    mediaUrl: string;
    timestamp: string;
    thumbnailUrl?: string;
  }[]
> => {
  if (!accessToken || !instagramUid) {
    throw createCustomError(2008, "Missing Instagram credentials", 502);
  }

  const limit = opts?.limit || LIMIT_IG_STORY_FETCH;

  const url = new URL(`https://graph.instagram.com/${instagramUid}/stories`);
  url.searchParams.set(
    "fields",
    "id,media_type,media_url,thumbnail_url,timestamp"
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", String(limit));

  const json = await fetchJSONWithAbort(
    url.toString(),
    IG_HTTP_TIMEOUT_MS,
    2008,
    "Failed to fetch stories from Instagram"
  );

  const data = Array.isArray(json?.data) ? json.data : null;
  if (!data) {
    throw createCustomError(2008, "Failed to fetch stories from Instagram", 502);
  }

  return data.map((item: any) => ({
    id: String(item.id),
    mediaType: (item.media_type as "IMAGE" | "VIDEO") ?? "IMAGE",
    igPostType: "STORY" as const,
    mediaUrl: String(item.media_url ?? ""),
    timestamp: String(item.timestamp ?? ""),
    thumbnailUrl: item.thumbnail_url ? String(item.thumbnail_url) : undefined,
  }));
};
