import { Linking } from "react-native";

// Instagram's story-camera deep link opens the IG app straight to the story
// composer when it's installed (the `instagram` scheme is whitelisted in the
// app's LSApplicationQueriesSchemes / Android queries). If the scheme can't be
// handled (IG not installed), fall back to the public site, which the OS opens
// in the IG app via its universal link or in the browser.
const STORY_CAMERA_URL = "instagram://story-camera";
const FALLBACK_URL = "https://www.instagram.com/";

/**
 * Open Instagram's story camera so the user can post a story, then return to the
 * app and pick it. Best-effort: tries the deep link, falls back to the website,
 * and silently no-ops if neither opens (matches the other links/ helpers — an
 * alert here would need a cycle-breaking refactor).
 */
export const openInstagramStoryCamera = async () => {
  try {
    await Linking.openURL(STORY_CAMERA_URL);
  } catch {
    try {
      await Linking.openURL(FALLBACK_URL);
    } catch {
      // Silently fail - opening an external app rarely fails.
    }
  }
};
