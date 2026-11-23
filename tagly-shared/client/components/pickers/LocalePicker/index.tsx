import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { SupportedLocale } from "@tagly/models/shared";
import { useTheme } from "../../../theme/ThemeProvider";
import { CustomButton } from "../../primitives/CustomButton";
import { BottomSheet } from "../../overlays/BottomSheet";

/** Region flag per locale. Shared with the sign-in locale chip. */
export const LOCALE_FLAG: Record<SupportedLocale, string> = {
  US: "🇺🇸",
  CZ: "🇨🇿",
};

type LocalePickerProps = {
  open: boolean;
  /** Currently selected locale (highlighted); null when not yet chosen. */
  current?: SupportedLocale | null;
  /** When false the sheet can't be dismissed (the required first pick). */
  dismissable?: boolean;
  onPick: (locale: SupportedLocale) => void;
  onClose?: () => void;
};

/**
 * Region chooser shown as a bottom sheet, shared by both mobile apps
 * (customer + advertiser). Used on the sign-in screen — forced
 * (non-dismissable) when no locale is known yet, and re-openable to change it
 * before creating an account. The locale drives currency + EU/US consent.
 *
 * Strings live in the colocated `localePicker` namespace (registered in
 * `tagly-shared/client/i18n/index.ts`, since a shared package owns its own strings).
 */
export function LocalePicker({
  open,
  current,
  dismissable = true,
  onPick,
  onClose,
}: LocalePickerProps) {
  const { t } = useTranslation("localePicker");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <BottomSheet open={open} onClose={dismissable ? onClose : undefined}>
      <View style={{ gap: spacing.sm }}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("heading")}
        </Text>
        <Text style={[text.body, { color: color.text.secondary }]}>
          {t("subtext")}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <CustomButton
          type={current === "US" ? "primary" : "secondary"}
          label={`${LOCALE_FLAG.US}  ${t("us")}`}
          onPress={() => onPick("US")}
        />
        <CustomButton
          type={current === "CZ" ? "primary" : "secondary"}
          label={`${LOCALE_FLAG.CZ}  ${t("cz")}`}
          onPress={() => onPick("CZ")}
        />
      </View>
    </BottomSheet>
  );
}
