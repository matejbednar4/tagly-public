import { openSettings } from "react-native-permissions";
import { customAlert } from "../../components/feedback/alert/customAlert";

/**
 * Reusable "you need to grant this in Settings" prompt. Shows a cross-platform
 * alert with an Open-Settings + Cancel pair and deep-links to the app's OS
 * settings page on confirm — for when a permission was denied and the only way
 * back is the system settings (location, photo library, notifications, …).
 *
 * Copy is caller-provided so it stays localized and specific to the permission
 * being requested; the deep-link itself is the reusable part.
 */
export function openAppSettingsAlert({
  title,
  message,
  settingsLabel,
  cancelLabel,
}: {
  title: string;
  message: string;
  settingsLabel: string;
  cancelLabel: string;
}): void {
  customAlert(title, message, [
    { text: settingsLabel, onPress: () => void openSettings().catch(() => {}) },
    { text: cancelLabel, style: "cancel" },
  ]);
}
