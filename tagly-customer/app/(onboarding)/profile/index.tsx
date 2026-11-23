import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import type { Gender } from "@tagly/models/shared";
import {
  useTheme,
  CustomButton,
  CustomTextInput,
  CustomPicker,
  type CustomPickerHandle,
  InterestsPicker,
  StepProgressOverline,
  BottomActionBar,
} from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";

const MAX_INTERESTS = 3;

// Autofill/paste inserts many characters in one change event while typing inserts
// one — treat a 3+ char jump as a fill, so an iOS name suggestion advances the
// flow hands-free just like pressing "next".
const isBulkFill = (prev: string, next: string) =>
  next.trim().length - prev.trim().length >= 3;

/**
 * Profile step: name (required), gender (optional dropdown), and up to 3
 * interests (optional). Only the name is required — it carries the sole asterisk,
 * and the Continue CTA lists what's still missing, mirroring the advertiser
 * business wizard's step 1. Keyboard flow chains hands-free: the name's "next"
 * opens the gender picker, and picking a gender opens the interests picker; a
 * pre-filled name (OAuth suggestion) auto-opens the gender picker on mount.
 * Sends interest **slugs** — the backend resolves them to rows by unique slug.
 *
 * App Review 5.1.1(v) note: the auto-open is what made a reviewer read gender
 * as required, so the picker SHEETS carry "(optional)" in their headings
 * (`genderPickerHeading`, `interestsHeading`) while the on-screen field labels
 * stay plain — the required/optional signal at field level is the single
 * asterisk on the name.
 */
export default function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { suggestedFullName, saveProfileStep, stepProgress } = useOnboarding();
  const progress = stepProgress("profile");

  const [fullName, setFullName] = useState(suggestedFullName ?? "");
  // null = nothing preselected; defaults to UNSPECIFIED on submit if untouched.
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestSlugs, setInterestSlugs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // The pinned BottomActionBar overlays the scroll; reserve its measured height
  // as bottom padding so the last field never sits under the Continue button.
  const [barHeight, setBarHeight] = useState(0);

  // Keyboard "next" walks the step hands-free: name → gender picker → interests
  // picker. Pickers can't take keyboard focus, so they join via the handle.
  const genderPickerRef = useRef<CustomPickerHandle>(null);
  const interestsPickerRef = useRef<CustomPickerHandle>(null);

  // Leaving the name (via "next" or an autofill/paste) hands off to the next
  // unfilled step — gender if it's unset, otherwise interests.
  const advanceFromName = () => {
    if (!gender) genderPickerRef.current?.open();
    else interestsPickerRef.current?.open();
  };

  // A pre-filled name (OAuth suggestion) skips the typing that would otherwise
  // hand off to the pickers — auto-open the gender picker instead, after a
  // beat so the screen transition settles. Mount-only by design: it must not
  // re-fire on later renders (e.g. after the user closes the sheet unpicked).
  useEffect(() => {
    if ((suggestedFullName ?? "").trim().length === 0) return;
    const timer = setTimeout(() => genderPickerRef.current?.open(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the name is required; the same array drives the CTA's disabled state and
  // the "still needed" line under it, so the two can never disagree.
  const missing = [!fullName.trim() && t("nameLabel")].filter(
    (f): f is string => typeof f === "string",
  );
  const valid = missing.length === 0;

  const genderItems: { value: Gender; label: string }[] = [
    { value: "MALE", label: t("male") },
    { value: "FEMALE", label: t("female") },
    { value: "UNSPECIFIED", label: t("unspecified") },
  ];

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const next = await saveProfileStep({
      fullName: fullName.trim(),
      gender: gender ?? "UNSPECIFIED",
      interestSlugs,
    });
    if (next) router.replace(next);
    else setSaving(false);
  };

  // Field label; `required` appends a muted asterisk (tertiary, not danger — it
  // marks "must be filled", not an error). Optional fields carry a plain label,
  // so the single asterisk is enough to signal what's mandatory.
  const fieldLabel = (label: string, required?: boolean) => (
    <Text style={[text.bodyMedium, { color: color.text.primary }]}>
      {label}
      {required ? <Text style={{ color: color.text.tertiary }}> *</Text> : null}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        // Measured to the caret, so it clears ~half the 56px input plus a gap.
        bottomOffset={spacing["3xl"]}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: layout.screenPadding,
          // Own the top inset here (no SafeAreaView) so the scroll fills the
          // screen and content scrolls under the notch, sitting the standard
          // stepped-screen gap below it — matches the business wizard.
          paddingTop: insets.top + layout.screenPadding,
          gap: spacing.xl,
          // Reserve the pinned bar's measured height so the last field clears it.
          paddingBottom: barHeight + spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {progress && (
          <StepProgressOverline step={progress.step} total={progress.total} />
        )}
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.display, { color: color.text.primary }]}>
            {t("heading")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("subheading")}
          </Text>
        </View>

        {/* Name — the only required field. "Next" (or an autofill/paste) opens
            the gender picker, or skips to interests if a gender is already set. */}
        <View style={{ gap: spacing.sm }}>
          {fieldLabel(t("nameLabel"), true)}
          <CustomTextInput
            placeholder={t("namePlaceholder")}
            value={fullName}
            onChangeText={(name) => {
              const bulk = isBulkFill(fullName, name);
              setFullName(name);
              if (bulk) advanceFromName();
            }}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={advanceFromName}
          />
        </View>

        {/* Gender — optional dropdown. Picking one hands the flow to interests
            (after the sheet's close animation, so the keyboard doesn't fight it). */}
        <View style={{ gap: spacing.sm }}>
          {fieldLabel(t("genderLabel"))}
          <CustomPicker
            pickerRef={genderPickerRef}
            items={genderItems}
            value={gender}
            setValue={(g) => {
              setGender(g);
              if (g && interestSlugs.length === 0) {
                setTimeout(() => interestsPickerRef.current?.open(), 250);
              }
            }}
            placeholder={t("genderPlaceholder")}
            heading={t("genderPickerHeading")}
            preserveOrder
          />
        </View>

        {/* Interests — optional, up to 3, from the catalog. */}
        <View style={{ gap: spacing.sm }}>
          {fieldLabel(t("interestsLabel"))}
          <InterestsPicker
            pickerRef={interestsPickerRef}
            value={interestSlugs}
            setValue={setInterestSlugs}
            maxItems={MAX_INTERESTS}
            placeholder={t("interestsPlaceholder")}
            heading={t("interestsHeading")}
            searchPlaceholder={t("interestsSearch")}
            allLabel={t("interestsAll")}
            doneLabel={t("interestsDone")}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* Continue pinned in the shared bottom bar (top shadow, owns the bottom
          safe-area inset). `keyboardBehavior="hide"` fades it out while the name
          field is focused so it can't cover the field, returning on dismiss. The
          still-missing line below (just the name) explains the disabled CTA. */}
      <BottomActionBar
        onHeightChange={setBarHeight}
        gap={spacing.xs}
        keyboardBehavior="hide"
      >
        <CustomButton
          type="primary"
          label={t("continue")}
          onPress={submit}
          loading={saving}
          disabled={!valid}
        />
        {!valid ? (
          <Text
            style={[
              text.caption,
              { color: color.on.dangerText, textAlign: "center" },
            ]}
          >
            {t("missingHint", { fields: missing.join(", ") })}
          </Text>
        ) : null}
      </BottomActionBar>
    </View>
  );
}
