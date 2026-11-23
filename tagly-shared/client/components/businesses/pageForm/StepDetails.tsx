import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { CustomButton } from "../../primitives/CustomButton";
import { CustomTextInput } from "../../primitives/CustomTextInput";
import { CustomPicker } from "../../pickers/CustomPicker";
import { BottomSheet } from "../../overlays/BottomSheet";
import { Toggle } from "../../primitives/Toggle";
import { useTheme } from "../../../theme/ThemeProvider";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import {
  EmailSchema,
  PhoneSchema,
  type SupportedLocale,
} from "@tagly/models/shared";
import { BUSINESS_DESCRIPTION_MAX_LENGTH } from "@tagly/models/v2/crossApp";
import { StepShell, FieldLabel } from "./StepShell";

export type DetailsValues = {
  description: string;
  instagramTag: string;
  websiteUrl: string;
  reservationUrl: string;
  menuUrl: string;
  phoneNumber: string;
  contactEmail: string;
  /**
   * Search aliases as raw comma-separated text — ADMIN-ONLY (rendered only
   * when the host passes `enableTags`; advertiser hosts never do, and never
   * submit it). Parse to the wire array with {@link parseBusinessTags}.
   */
  tags: string;
};

/**
 * Prepend `https://` when the user omits a scheme so a bare "cafetagly.com"
 * still forms the valid URL the wire (`z.url()`) requires. Empty stays empty.
 */
export const normalizeUrl = (value: string): string => {
  const s = value.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

/**
 * Raw comma-separated tags text → the wire array: trimmed, lowercased, empty
 * entries dropped, capped at 5 (the `AdminBusinessTagsSchema` rule).
 */
export const parseBusinessTags = (text: string): string[] =>
  text
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

/** One open interval (minutes from local midnight; close ≤ open ⇒ next day). */
export type Period = { open: number; close: number };
/** Per weekday, the open intervals. Absent or empty array = closed that day. */
export type WeekHours = Record<number, Period[]>;

/** Rendered week order: Monday first, Sunday last (business convention). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = [
  "day0",
  "day1",
  "day2",
  "day3",
  "day4",
  "day5",
  "day6",
] as const;
/** Full day names for the editor's per-day rows (short keys fit summaries). */
const DAY_FULL_KEYS = [
  "day0Full",
  "day1Full",
  "day2Full",
  "day3Full",
  "day4Full",
  "day5Full",
  "day6Full",
] as const;
const DEFAULT_PERIOD: Period = { open: 9 * 60, close: 17 * 60 };
/** Keeps total periods within the wire cap (21 = 3 × 7 days). */
const MAX_PERIODS_PER_DAY = 3;

/** "9:00 AM" (US) / "17:00" (CZ 24h). */
const formatMinute = (minute: number, locale: SupportedLocale): string => {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  if (locale === "CZ") return `${h}:${String(m).padStart(2, "0")}`;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/** "9:00 AM–5:00 PM"; a 1440 close renders as the midnight label. */
const rangeLabel = (p: Period, locale: SupportedLocale, midnight: string) =>
  `${formatMinute(p.open, locale)}–${
    p.close === 1440 ? midnight : formatMinute(p.close, locale)
  }`;

/** One distinct time range and the (week-ordered) days that have it. */
type HourGroup = Period & { days: number[] };

/**
 * WeekHours → distinct ranges with their days, in order of first appearance
 * Monday-first. This is the display model everywhere: the editor's schedule
 * rows and the trigger field's summary both render groups, and removing a
 * group strips that range from all its days.
 */
const groupHours = (hours: WeekHours): HourGroup[] => {
  const map = new Map<string, HourGroup>();
  for (const day of WEEK_ORDER) {
    for (const p of hours[day] ?? []) {
      const key = `${p.open}-${p.close}`;
      const group = map.get(key);
      if (group) group.days.push(day);
      else map.set(key, { open: p.open, close: p.close, days: [day] });
    }
  }
  return [...map.values()];
};

/** Week-ordered days → "Mon–Fri, Sun" (dash for runs of 3+, commas otherwise). */
const compressDays = (
  days: number[],
  dayLabel: (day: number) => string,
): string => {
  const positions = days.map((d) => WEEK_ORDER.indexOf(d));
  const parts: string[] = [];
  for (let i = 0; i < positions.length;) {
    let j = i;
    while (j + 1 < positions.length && positions[j + 1] === positions[j] + 1) {
      j++;
    }
    const run = positions.slice(i, j + 1).map((p) => dayLabel(WEEK_ORDER[p]));
    parts.push(
      run.length >= 3 ? `${run[0]}–${run[run.length - 1]}` : run.join(", "),
    );
    i = j + 1;
  }
  return parts.join(", ");
};

/** A normalized URL is valid if it has a dotted host and no spaces. */
const URL_OK = /^https?:\/\/[^\s/]+\.[^\s]+/i;

/** The optional sections, in the order they show both as chips and as fields. */
export type SectionKey =
  | "instagram"
  | "description"
  | "hours"
  | "website"
  | "menu"
  | "reservation"
  | "phone"
  | "email"
  | "tags";

/** Text fields backing each chip (all but `hours`, which drives `WeekHours`). */
const FIELD_OF: Record<Exclude<SectionKey, "hours">, keyof DetailsValues> = {
  instagram: "instagramTag",
  description: "description",
  website: "websiteUrl",
  menu: "menuUrl",
  reservation: "reservationUrl",
  phone: "phoneNumber",
  email: "contactEmail",
  tags: "tags",
};

/**
 * Step 3 — every field is opt-in via a row of chips ("what would you like to
 * add?") so the step doesn't dump a dozen inputs at once. Instagram is
 * pre-selected (the most common add); the rest start collapsed. Selecting a
 * chip reveals its field; deselecting hides AND clears it (so hidden data is
 * never submitted). Opening hours opens in a sheet (per-day open/closed, one or
 * more time ranges per day, copy-to-all-days). The `tags` chip (search
 * aliases) renders only for hosts passing `enableTags` — the admin app.
 */
export function StepDetails({
  header,
  businessName,
  values,
  onChange,
  hours,
  setHours,
  locale,
  onBack,
  onSubmit,
  submitting,
  topInset,
  ctaLabel,
  focusSection,
  title,
  subtitle,
  enableTags = false,
}: {
  header?: ReactNode;
  /** Forwarded to StepShell — see its docblock. */
  topInset?: boolean;
  /** The name from step 1, so copy can say the business by name once known. */
  businessName: string;
  values: DetailsValues;
  onChange: (patch: Partial<DetailsValues>) => void;
  hours: WeekHours;
  setHours: (hours: WeekHours) => void;
  locale: SupportedLocale;
  onBack?: () => void;
  onSubmit: () => void;
  submitting: boolean;
  /** CTA label override (edit screens pass "Save"); defaults to Create. */
  ctaLabel?: string;
  /**
   * Chip to force open on mount — the edit screen's deep-link target (a
   * detail-screen "Add …" prompt lands here focused on that field).
   */
  focusSection?: SectionKey;
  /** Title/subtitle overrides for the edit screens; default to create copy. */
  title?: string;
  subtitle?: string;
  /** Render the admin-only search-tags section (`values.tags`). */
  enableTags?: boolean;
}) {
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const business = businessName.trim() || t("yourBusiness");

  // A section is open if the user selected its chip — seeded from any value
  // already set (so navigating back to this step keeps fields revealed).
  // Instagram is pre-selected (most-added field) even when empty.
  const [active, setActive] = useState<Record<SectionKey, boolean>>(() => ({
    instagram: true,
    description: !!values.description.trim(),
    hours: Object.values(hours).some((p) => p && p.length > 0),
    website: !!values.websiteUrl.trim(),
    menu: !!values.menuUrl.trim(),
    reservation: !!values.reservationUrl.trim(),
    phone: !!values.phoneNumber.trim(),
    email: !!values.contactEmail.trim(),
    tags: !!values.tags.trim(),
    // A deep-linked section starts revealed even when empty.
    ...(focusSection ? { [focusSection]: true } : {}),
  }));
  const [hoursSheetOpen, setHoursSheetOpen] = useState(false);

  const toggle = (key: SectionKey) => {
    const next = !active[key];
    setActive((a) => ({ ...a, [key]: next }));
    if (key === "hours") {
      // Selecting only reveals the trigger field (the sheet opens on tap,
      // never automatically); deselecting clears the schedule.
      if (!next) setHours({});
      return;
    }
    if (!next) {
      // Removing a section clears its data so nothing hidden gets submitted.
      onChange({ [FIELD_OF[key]]: "" });
    }
  };

  // Trigger-row summary: the grouped schedule ("Mon–Fri 9:00 AM–5:00 PM").
  const hoursSummary = groupHours(hours)
    .map(
      (g) =>
        `${compressDays(g.days, (d) => t(DAY_KEYS[d]))} ${rangeLabel(g, locale, t("midnight"))}`,
    )
    .join(", ");

  const chips: { key: SectionKey; label: string }[] = [
    { key: "instagram", label: t("instagramLabel") },
    { key: "description", label: t("descriptionLabel") },
    { key: "hours", label: t("hoursLabel") },
    { key: "website", label: t("websiteLabel") },
    { key: "menu", label: t("menuLabel") },
    { key: "reservation", label: t("reservationLabel") },
    { key: "phone", label: t("phoneLabel") },
    { key: "email", label: t("emailLabel") },
    // Admin-only search aliases (see DetailsValues.tags).
    ...(enableTags
      ? [{ key: "tags" as const, label: t("tagsLabel") }]
      : []),
  ];

  const urlError = (value: string) =>
    value.trim() && !URL_OK.test(normalizeUrl(value))
      ? t("urlError")
      : undefined;
  const phoneInvalid =
    !!values.phoneNumber.trim() &&
    !PhoneSchema.safeParse(values.phoneNumber.trim()).success;
  const emailInvalid =
    !!values.contactEmail.trim() &&
    !EmailSchema.safeParse(values.contactEmail.trim()).success;

  const valid =
    !urlError(values.websiteUrl) &&
    !urlError(values.reservationUrl) &&
    !urlError(values.menuUrl) &&
    !phoneInvalid &&
    !emailInvalid;

  const urlField = (
    key: "websiteUrl" | "reservationUrl" | "menuUrl",
    label: string,
    placeholder: string,
  ) => (
    <View style={{ gap: spacing.sm }}>
      <FieldLabel>{label}</FieldLabel>
      <CustomTextInput
        placeholder={placeholder}
        value={values[key]}
        onChangeText={(v) => onChange({ [key]: v })}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={urlError(values[key])}
      />
    </View>
  );

  return (
    <StepShell
      header={header}
      topInset={topInset}
      title={title ?? t("detailsTitle")}
      subtitle={subtitle ?? t("detailsSubtitle")}
      onBack={onBack}
      cta={
        <CustomButton
          type="primary"
          label={ctaLabel ?? t("create")}
          onPress={onSubmit}
          loading={submitting}
          disabled={!valid}
        />
      }
    >
      {/* Opt-in chips: pick what to add (Instagram is pre-selected). */}
      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t("addMoreLabel")}</FieldLabel>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          {chips.map(({ key, label }) => {
            const on = active[key];
            return (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({
                  pressed,
                  hovered,
                }: {
                  pressed: boolean;
                  hovered?: boolean;
                }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.pill,
                    backgroundColor: on ? color.ink : color.surface,
                    boxShadow: theme.shadow.chip,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Ionicons
                  name={on ? "checkmark" : "add"}
                  size={15}
                  color={on ? color.on.ink : color.text.secondary}
                />
                <Text
                  style={[
                    text.label,
                    { color: on ? color.on.ink : color.text.primary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Revealed fields, in chip order. */}
      {active.instagram ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("instagramLabel")}</FieldLabel>
          <CustomTextInput
            prefix="@"
            placeholder={t("instagramPlaceholder")}
            value={values.instagramTag}
            onChangeText={(instagramTag) => onChange({ instagramTag })}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}

      {active.description ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("descriptionLabel")}</FieldLabel>
          <CustomTextInput
            placeholder={t("descriptionPlaceholder", { business })}
            value={values.description}
            onChangeText={(description) => onChange({ description })}
            multiline
            numberOfLines={4}
            // Hard cap matches the wire schema (single source), so the client
            // can't submit more than the server accepts.
            maxLength={BUSINESS_DESCRIPTION_MAX_LENGTH}
            height={120}
          />
          <Text
            style={[
              text.caption,
              { color: color.text.tertiary, textAlign: "right" },
            ]}
          >
            {values.description.length}/{BUSINESS_DESCRIPTION_MAX_LENGTH}
          </Text>
        </View>
      ) : null}

      {active.hours ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("hoursLabel")}</FieldLabel>
          {/* Field-styled trigger → opens the editor in a sheet (keeps the
              7-day editor off the page). pointerEvents:none lets the Pressable
              own the tap while the input just renders the look + summary. */}
          <Pressable
            onPress={() => setHoursSheetOpen(true)}
            accessibilityRole="button"
          >
            <View pointerEvents="none">
              <CustomTextInput
                editable={false}
                value={hoursSummary}
                placeholder={t("hoursPlaceholder")}
                rightIconName="chevron-forward"
              />
            </View>
          </Pressable>
        </View>
      ) : null}

      {active.website
        ? urlField("websiteUrl", t("websiteLabel"), t("websitePlaceholder"))
        : null}
      {active.menu
        ? urlField("menuUrl", t("menuLabel"), t("menuPlaceholder"))
        : null}
      {active.reservation
        ? urlField(
            "reservationUrl",
            t("reservationLabel"),
            t("reservationPlaceholder"),
          )
        : null}

      {active.phone ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("phoneLabel")}</FieldLabel>
          <CustomTextInput
            placeholder={locale === "CZ" ? "+420" : "+1"}
            value={values.phoneNumber}
            onChangeText={(phoneNumber) => onChange({ phoneNumber })}
            keyboardType="phone-pad"
            error={phoneInvalid ? t("phoneError") : undefined}
          />
        </View>
      ) : null}

      {active.email ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("emailLabel")}</FieldLabel>
          <CustomTextInput
            placeholder={t("emailPlaceholder")}
            value={values.contactEmail}
            onChangeText={(contactEmail) => onChange({ contactEmail })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            error={emailInvalid ? t("emailError") : undefined}
          />
        </View>
      ) : null}

      {enableTags && active.tags ? (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>{t("tagsLabel")}</FieldLabel>
          <CustomTextInput
            placeholder={t("tagsPlaceholder")}
            value={values.tags}
            onChangeText={(tags) => onChange({ tags })}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[text.caption, { color: color.text.tertiary }]}>
            {t("tagsHint")}
          </Text>
        </View>
      ) : null}

      <BottomSheet
        open={hoursSheetOpen}
        onClose={() => setHoursSheetOpen(false)}
      >
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("hoursLabel")}
          </Text>
          <HoursEditor hours={hours} setHours={setHours} locale={locale} />
          <CustomButton
            type="primary"
            label={t("hoursDone")}
            onPress={() => setHoursSheetOpen(false)}
          />
        </View>
      </BottomSheet>
    </StepShell>
  );
}

/**
 * Weekly hours editor on the industry-standard model (Google Business Profile,
 * Square): one row per day with an open/closed {@link Toggle} and the day's
 * ranges summarized inline. Tapping an open row expands it — one day at a time
 * — to edit its ranges with pickers, add a second/third range (split hours,
 * capped at MAX_PERIODS_PER_DAY), or apply the day's hours to the whole week.
 * Toggling a closed day on seeds the default 9–5 and expands it for tweaking.
 * Overnight is supported by the wire (close ≤ open ⇒ next day); the pickers
 * keep a fixed 30-minute grid.
 */
function HoursEditor({
  hours,
  setHours,
  locale,
}: {
  hours: WeekHours;
  setHours: (hours: WeekHours) => void;
  locale: SupportedLocale;
}) {
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  // The one day whose ranges are being edited (accordion — collapsing keeps
  // the week overview scannable). Fresh per sheet open; BottomSheet unmounts
  // its children when closed.
  const [expanded, setExpanded] = useState<number | null>(null);

  // 30-minute steps; the close list ends at 24:00 (1440) instead of 0.
  const openItems = Array.from({ length: 48 }, (_, i) => ({
    value: i * 30,
    label: formatMinute(i * 30, locale),
  }));
  const closeItems = Array.from({ length: 48 }, (_, i) => ({
    value: (i + 1) * 30,
    label:
      (i + 1) * 30 === 1440
        ? t("midnight")
        : formatMinute((i + 1) * 30, locale),
  }));

  const setDay = (day: number, periods: Period[]) =>
    setHours({ ...hours, [day]: periods });

  const toggleDay = (day: number, on: boolean) => {
    setDay(day, on ? [{ ...DEFAULT_PERIOD }] : []);
    setExpanded(on ? day : expanded === day ? null : expanded);
  };
  const addPeriod = (day: number) => {
    const cur = hours[day] ?? [];
    if (cur.length >= MAX_PERIODS_PER_DAY) return;
    setDay(day, [...cur, { ...DEFAULT_PERIOD }]);
  };
  const removePeriod = (day: number, i: number) =>
    setDay(
      day,
      (hours[day] ?? []).filter((_, idx) => idx !== i),
    );
  const patchPeriod = (day: number, i: number, patch: Partial<Period>) =>
    setDay(
      day,
      (hours[day] ?? []).map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const applyToAll = (day: number) => {
    const src = (hours[day] ?? []).map((p) => ({ ...p }));
    const next: WeekHours = {};
    for (const d of WEEK_ORDER) next[d] = src.map((p) => ({ ...p }));
    setHours(next);
  };

  return (
    <View>
      {WEEK_ORDER.map((day, idx) => {
        const periods = hours[day] ?? [];
        const isOpen = periods.length > 0;
        const isExpanded = expanded === day;
        return (
          <View
            key={day}
            style={{
              borderTopWidth: idx > 0 ? 1 : 0,
              borderTopColor: color.border.divider,
            }}
          >
            {/* Day row: name + ranges summary, toggle at the right. Tapping
                an open row expands/collapses its editor; tapping a closed row
                just opens the day (same as its toggle). */}
            <Pressable
              onPress={() =>
                isOpen
                  ? setExpanded(isExpanded ? null : day)
                  : toggleDay(day, true)
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              style={({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                  {t(DAY_FULL_KEYS[day])}
                </Text>
                <Text
                  style={[
                    text.caption,
                    {
                      color: isOpen
                        ? color.text.secondary
                        : color.text.tertiary,
                    },
                  ]}
                >
                  {isOpen
                    ? periods
                        .map((p) => rangeLabel(p, locale, t("midnight")))
                        .join(", ")
                    : t("closed")}
                </Text>
              </View>
              {isOpen ? (
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={color.text.tertiary}
                />
              ) : null}
              <Toggle
                value={isOpen}
                onValueChange={(on) => toggleDay(day, on)}
              />
            </Pressable>

            {/* Expanded editor for this day's ranges. */}
            {isExpanded && isOpen ? (
              <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
                {periods.map((p, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <CustomPicker
                        items={openItems}
                        value={p.open}
                        setValue={(open) =>
                          open !== null && patchPeriod(day, i, { open })
                        }
                        heading={t("opensAt")}
                        preserveOrder
                      />
                    </View>
                    <Text style={[text.body, { color: color.text.tertiary }]}>
                      –
                    </Text>
                    <View style={{ flex: 1 }}>
                      <CustomPicker
                        items={closeItems}
                        value={p.close}
                        setValue={(close) =>
                          close !== null && patchPeriod(day, i, { close })
                        }
                        heading={t("closesAt")}
                        preserveOrder
                      />
                    </View>
                    {periods.length > 1 ? (
                      <Pressable
                        onPress={() => removePeriod(day, i)}
                        hitSlop={12}
                        accessibilityRole="button"
                        style={({
                          pressed,
                          hovered,
                        }: {
                          pressed: boolean;
                          hovered?: boolean;
                        }) => pressFeedbackStyle({ pressed, hovered })}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={color.text.tertiary}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}

                {/* Split hours + the "same every day" shortcut. */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {periods.length < MAX_PERIODS_PER_DAY ? (
                    <Pressable
                      onPress={() => addPeriod(day)}
                      hitSlop={8}
                      accessibilityRole="button"
                      style={({
                        pressed,
                        hovered,
                      }: {
                        pressed: boolean;
                        hovered?: boolean;
                      }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.xs,
                        },
                        pressFeedbackStyle({ pressed, hovered }),
                      ]}
                    >
                      <Ionicons name="add" size={16} color={color.ink} />
                      <Text style={[text.label, { color: color.ink }]}>
                        {t("addHours")}
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    onPress={() => applyToAll(day)}
                    hitSlop={8}
                    accessibilityRole="button"
                    style={({
                      pressed,
                      hovered,
                    }: {
                      pressed: boolean;
                      hovered?: boolean;
                    }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                      },
                      pressFeedbackStyle({ pressed, hovered }),
                    ]}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={14}
                      color={color.text.secondary}
                    />
                    <Text style={[text.label, { color: color.text.secondary }]}>
                      {t("applyToAll")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
