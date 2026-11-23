import { Platform } from "react-native";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { localStore, localGet, localDelete } from "../storage/localStorage";
import { SHARED_LOCAL_KEYS } from "../storage/keys";

/**
 * The host app's store listing, platform-resolved: the user-facing store name
 * plus a deep link to the listing, for explicit "rate us" CTAs (the About
 * sheet). Reads the same `APP_STORE_URL` / `PLAY_STORE_URL` extra values the
 * update-required wall uses (each app declares its own in `app.config.ts`), so
 * this works for any app in the family without prop plumbing. On iOS the link
 * jumps straight into the review composer (`action=write-review`); Play has no
 * equivalent deep-link param, so Android opens the listing.
 *
 * `url` is null when the host app doesn't declare the extra values — callers
 * should hide their CTA then. (For *unprompted* review asks after a positive
 * moment, use `queueStoreReview`/`consumePendingStoreReview` below instead —
 * the in-app OS prompt, which `expo-store-review` supports on both iOS and
 * Android/Play.)
 */
export function getStoreListing(): {
  store: "App Store" | "Google Play";
  url: string | null;
} {
  const { APP_STORE_URL, PLAY_STORE_URL } = (Constants.expoConfig?.extra ??
    {}) as { APP_STORE_URL?: string; PLAY_STORE_URL?: string };

  if (Platform.OS === "ios") {
    return {
      store: "App Store",
      url: APP_STORE_URL ? `${APP_STORE_URL}?action=write-review` : null,
    };
  }
  return { store: "Google Play", url: PLAY_STORE_URL ?? null };
}

/**
 * Best-effort in-app store-review prompt. Module-private — the app only ever goes
 * through the queue/consume pair below; this is the shared implementation they use.
 *
 * We deliberately do NOT throttle client-side. Both stores already cap the actual
 * prompt natively — iOS shows it at most 3 times / 365 days and never reshows for
 * an already-rated version; Android's Play In-App Review enforces its own quota —
 * and `requestReview()` returns no "was it shown" signal. So any attempt-based
 * client throttle would count *calls we can't confirm were displayed* and could
 * suppress a prompt the OS would actually have shown, only ever *reducing* real
 * ratings. Instead we call it at a positive moment and let the OS decide; the
 * stores guarantee the user is never spammed.
 *
 * @returns true if the request was dispatched to the OS, false if it's
 *   unavailable (iOS TestFlight / unsupported, where it can't be shown).
 */
async function requestStoreReview(delayMs = 1500): Promise<boolean> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return false; // iOS TestFlight / unsupported returns false

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Best-effort: the OS may silently ignore it, and throttles displays itself.
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

/**
 * Queue a review prompt for the next stable screen.
 * Call this after a positive action (e.g. monetizing a story) before navigating
 * away; the destination screen calls `consumePendingStoreReview()`.
 */
export async function queueStoreReview(): Promise<void> {
  try {
    const existing = await localGet(SHARED_LOCAL_KEYS.PENDING_REVIEW);
    if (existing === "1") return;
    await localStore(SHARED_LOCAL_KEYS.PENDING_REVIEW, "1");
  } catch {
    // ignore
  }
}

/**
 * If a review prompt was queued, clear the flag and request the review. Call on a
 * stable screen after mount/focus (ideally inside `InteractionManager`). No-op
 * when nothing is queued, so it's safe on every mount.
 *
 * @returns true if a review was requested, false otherwise.
 */
export async function consumePendingStoreReview(): Promise<boolean> {
  try {
    const pending = await localGet(SHARED_LOCAL_KEYS.PENDING_REVIEW);
    if (pending !== "1") return false;

    // Clear the flag first to avoid duplicate prompts.
    await localDelete(SHARED_LOCAL_KEYS.PENDING_REVIEW);

    // Request now, with no delay (the caller already deferred past interactions).
    return await requestStoreReview(0);
  } catch {
    return false;
  }
}
