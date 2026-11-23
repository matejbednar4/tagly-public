import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeProvider";
import { CustomButton } from "../../primitives/CustomButton";
import { BottomSheet } from "../../overlays/BottomSheet";
import type { Language } from "../../../i18n/detectLocale";

/**
 * Each language labelled in **itself** (its endonym), never translated — an
 * option has to be readable to someone who can't read the language currently on
 * screen, which is the whole reason they're opening this picker.
 */
export const LANGUAGE_ENDONYM: Record<Language, string> = {
  en: "English",
  cs: "Čeština",
};

/** Rendered in list order, so the options don't reshuffle as the pick changes. */
const LANGUAGES: Language[] = ["en", "cs"];

type LanguagePickerProps = {
  open: boolean;
  /** Currently selected language (highlighted). */
  current: Language;
  onPick: (language: Language) => void;
  onClose: () => void;
};

/**
 * Display-language chooser shown as a bottom sheet, shared by both mobile apps.
 * Used by the onboarding carousel, where it is the ONLY language control a
 * signed-out user can reach (the settings screen is behind auth), so a wrong
 * first-launch detection stays fixable — it costs the artwork as well as the
 * copy, since the step screenshots are localized too.
 *
 * Presentational: the caller owns the open state, renders the trigger, and
 * persists the pick (`useUserPreferences().setDisplayLanguage`). Twin of
 * {@link LocalePicker}, which chooses the account *region* (currency + EU/US
 * consent) — a deliberately separate axis from the display language.
 *
 * Strings live in the colocated `languagePicker` namespace (registered in
 * `tagly-shared/client/i18n/index.ts`, since a shared package owns its own strings).
 */
export function LanguagePicker({
  open,
  current,
  onPick,
  onClose,
}: LanguagePickerProps) {
  const { t } = useTranslation("languagePicker");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("heading")}
        </Text>
        <Text style={[text.body, { color: color.text.secondary }]}>
          {t("subtext")}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {LANGUAGES.map((lang) => (
          <CustomButton
            key={lang}
            type={current === lang ? "primary" : "secondary"}
            label={LANGUAGE_ENDONYM[lang]}
            onPress={() => onPick(lang)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
