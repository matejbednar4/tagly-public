import * as WebBrowser from "expo-web-browser";
import { websiteUrl } from "./websiteUrl";

/**
 * Opens the Instagram data-deletion / disconnect help page (delete your Tagly
 * account, remove Tagly in Instagram's settings, or contact support). The page
 * itself lives in the marketing-site repo. Surfaced from the "about your
 * connection" sheet on the Instagram settings screen.
 */
export const openInstagramDataDeletion = async () => {
  try {
    await WebBrowser.openBrowserAsync(websiteUrl("/instagram-data-deletion"));
  } catch (err) {
    // Silently fail - browser opening rarely fails and alert would need cycle-breaking refactor
  }
};
