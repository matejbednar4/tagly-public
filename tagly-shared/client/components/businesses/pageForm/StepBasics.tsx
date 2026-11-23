import { useRef, type ReactNode } from "react";
import { Keyboard, Text, View, type TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { CustomButton } from "../../primitives/CustomButton";
import { CustomTextInput } from "../../primitives/CustomTextInput";
import {
  CustomPicker,
  type CustomPickerHandle,
} from "../../pickers/CustomPicker";
import { useTheme } from "../../../theme/ThemeProvider";
import { useCatalogLocalizer } from "../../../i18n/useCatalogLocalizer";
import {
  advertiserTypes,
  CZ_REGIONS,
  US_STATES,
  type SupportedLocale,
} from "@tagly/models/shared";
import { StepShell, FieldLabel, SectionHeading } from "./StepShell";

export type BasicsValues = {
  name: string;
  typeSlug: string | null;
  street: string;
  zip: string;
  city: string;
  region: string | null;
};

/**
 * Step 1 — name, business type (bundled catalog, slug-keyed), and address.
 * The country is locked to the passed `locale` (the advertiser's own locale,
 * enforced server-side too; the admin host picks the market per business), so
 * only the region picker varies: US states are required, Czech kraje are
 * optional (the geocoder resolves them).
 */
export function StepBasics({
  header,
  values,
  onChange,
  locale,
  onContinue,
  footer,
  topInset,
  ctaLabel,
  loading = false,
  title,
  subtitle,
}: {
  header?: ReactNode;
  values: BasicsValues;
  onChange: (patch: Partial<BasicsValues>) => void;
  locale: SupportedLocale;
  onContinue: () => void;
  footer?: ReactNode;
  /** Forwarded to StepShell — see its docblock. */
  topInset?: boolean;
  /** CTA label override (edit screens pass "Save"); defaults to Continue. */
  ctaLabel?: string;
  /** CTA spinner while an edit-screen save is in flight. */
  loading?: boolean;
  /** Title/subtitle overrides for the edit screens; default to create copy. */
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const { typeName } = useCatalogLocalizer();

  // Keyboard "next" walks the WHOLE step: name → type picker (opened
  // imperatively) → street → ZIP → city → region picker. Pickers can't take
  // keyboard focus, so they join the chain via CustomPickerHandle.open().
  const typePickerRef = useRef<CustomPickerHandle>(null);
  const streetRef = useRef<TextInput>(null);
  const zipRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const regionPickerRef = useRef<CustomPickerHandle>(null);

  // Autofill/paste inserts many characters in one change event while typing
  // inserts one — treat a 3+ char jump as a fill and hop to the next empty
  // field so an iOS address suggestion walks the chain hands-free.
  const isBulkFill = (prev: string, next: string) =>
    next.trim().length - prev.trim().length >= 3;

  const typeItems = [...advertiserTypes]
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map((type) => ({ value: type.slug, label: typeName(type.slug) }));

  const regionItems = (locale === "CZ" ? CZ_REGIONS : US_STATES).map((r) => ({
    value: r.value,
    label: r.label,
  }));

  // The still-missing required fields, in screen order — drives both the CTA's
  // disabled state and the "still needed" line under it, so the two can never
  // disagree.
  const missing = [
    !values.name.trim() && t("nameLabel"),
    !values.typeSlug && t("typeLabel"),
    !values.street.trim() && t("streetLabel"),
    !values.zip.trim() && t("zipLabel"),
    !values.city.trim() && t("cityLabel"),
    locale !== "CZ" && !values.region && t("regionLabelUs"),
  ].filter((f): f is string => typeof f === "string");
  const valid = missing.length === 0;

  return (
    <StepShell
      header={header}
      topInset={topInset}
      title={title ?? t("basicsTitle")}
      subtitle={subtitle ?? t("basicsSubtitle")}
      cta={
        <>
          <CustomButton
            type="primary"
            label={ctaLabel ?? t("continue")}
            onPress={onContinue}
            disabled={!valid}
            loading={loading}
          />
          {!valid ? (
            // Same treatment as CustomTextInput's error line, so "what's
            // blocking Continue" reads like the field errors it points at.
            <Text
              style={[
                text.caption,
                { color: color.on.dangerText, textAlign: "center" },
              ]}
            >
              {t("missingHint", { fields: missing.join(", ") })}
            </Text>
          ) : null}
        </>
      }
      footer={footer}
    >
      <View style={{ gap: spacing.sm }}>
        <FieldLabel required>{t("nameLabel")}</FieldLabel>
        <CustomTextInput
          placeholder={t("namePlaceholder")}
          value={values.name}
          onChangeText={(name) => onChange({ name })}
          autoCapitalize="words"
          autoComplete="organization"
          returnKeyType="next"
          submitBehavior="submit"
          // "Next" flows into the type picker; if a type is already chosen
          // (user came back to edit the name), skip ahead to the street.
          onSubmitEditing={() => {
            if (!values.typeSlug) typePickerRef.current?.open();
            else streetRef.current?.focus();
          }}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel required>{t("typeLabel")}</FieldLabel>
        <CustomPicker
          pickerRef={typePickerRef}
          items={typeItems}
          value={values.typeSlug}
          setValue={(typeSlug) => {
            onChange({ typeSlug });
            // Picking a type hands the flow to the address; wait out the
            // sheet's close animation so the keyboard doesn't fight it.
            if (typeSlug && !values.street.trim()) {
              setTimeout(() => streetRef.current?.focus(), 250);
            }
          }}
          placeholder={t("typePlaceholder")}
          heading={t("typeLabel")}
          searchable
          searchPlaceholder={t("typeSearch")}
        />
      </View>

      <SectionHeading>{t("addressHeading")}</SectionHeading>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel required>{t("streetLabel")}</FieldLabel>
        <CustomTextInput
          ref={streetRef}
          placeholder={t("streetPlaceholder")}
          value={values.street}
          onChangeText={(street) => {
            const bulk = isBulkFill(values.street, street);
            onChange({ street });
            if (bulk && !values.zip.trim()) zipRef.current?.focus();
          }}
          // Line-1 only, so the iOS keyboard's address suggestion fills just
          // the street here instead of dumping the whole address into one box.
          autoComplete="street-address"
          textContentType="streetAddressLine1"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => zipRef.current?.focus()}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <FieldLabel required>{t("zipLabel")}</FieldLabel>
          <CustomTextInput
            ref={zipRef}
            placeholder={t("zipPlaceholder")}
            value={values.zip}
            onChangeText={(zip) => {
              const bulk = isBulkFill(values.zip, zip);
              onChange({ zip });
              if (bulk && !values.city.trim()) cityRef.current?.focus();
            }}
            autoComplete="postal-code"
            textContentType="postalCode"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => cityRef.current?.focus()}
          />
        </View>
        <View style={{ flex: 2, gap: spacing.sm }}>
          <FieldLabel required>{t("cityLabel")}</FieldLabel>
          <CustomTextInput
            ref={cityRef}
            placeholder={t("cityPlaceholder")}
            value={values.city}
            onChangeText={(city) => {
              const bulk = isBulkFill(values.city, city);
              onChange({ city });
              // End of the text chain: a filled city hands off to the region
              // picker where one is still required (US); otherwise it just
              // puts the keyboard away.
              if (bulk) {
                if (locale !== "CZ" && !values.region) {
                  regionPickerRef.current?.open();
                } else {
                  Keyboard.dismiss();
                }
              }
            }}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            returnKeyType={locale !== "CZ" ? "next" : "done"}
            submitBehavior="submit"
            onSubmitEditing={() => {
              if (locale !== "CZ" && !values.region) {
                regionPickerRef.current?.open();
              }
            }}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel required={locale !== "CZ"}>
          {locale === "CZ" ? t("regionLabelCz") : t("regionLabelUs")}
        </FieldLabel>
        <CustomPicker
          pickerRef={regionPickerRef}
          items={regionItems}
          value={values.region}
          setValue={(region) => onChange({ region })}
          placeholder={t("regionPlaceholder")}
          heading={locale === "CZ" ? t("regionLabelCz") : t("regionLabelUs")}
          searchable
          searchPlaceholder={t("regionSearch")}
        />
      </View>
    </StepShell>
  );
}
