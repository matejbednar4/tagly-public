import * as WebBrowser from "expo-web-browser";
import { websiteUrl } from "./websiteUrl";

export const openTermsOfMonetization = async () => {
  try {
    await WebBrowser.openBrowserAsync(websiteUrl("/terms-of-monetization"));
  } catch (err) {
    // Silently fail - browser opening rarely fails and alert would need cycle-breaking refactor
  }
};
