import * as WebBrowser from "expo-web-browser";
import { websiteUrl } from "./websiteUrl";

export const openPrivacyPolicy = async () => {
  try {
    await WebBrowser.openBrowserAsync(websiteUrl("/privacy-policy"));
  } catch (err) {
    // Silently fail - browser opening rarely fails and alert would need cycle-breaking refactor
  }
};
