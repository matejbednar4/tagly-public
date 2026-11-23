import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  AffordancePill,
  callAuthed,
  customAlert,
  CustomButton,
  formatDate,
  InterestsPicker,
  SettingCard,
  useCatalogLocalizer,
  useTheme,
} from "@tagly/client";
import { ACCOUNT_UPDATE_COOLDOWNS } from "@tagly/models/shared";
import { updateInterests } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

const MAX_INTERESTS = 3;

/**
 * Follower-interests field on the Profile screen — shows the chosen interests as
 * chips; the "Edit" pill grows the card open to the shared `InterestsPicker` (up
 * to 3, by slug) + Save/Cancel. Save is blocked while the set is unchanged, and a
 * non-empty change is on a 60-day cooldown (Edit muted + a next-allowed note while
 * active). Reads + writes the shared `useCustomer` context.
 */
export function InterestsField() {
  const { t } = useTranslation("settingsProfile");
  // Shared confirm-alert copy ("Change {field} to {value}?"), same as EditableSetting.
  const { t: tc } = useTranslation("editableSetting");
  const { interestName } = useCatalogLocalizer();
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const { customer, setCustomer } = useCustomer();

  const currentSlugs = useMemo(
    () => (customer?.interests ?? []).map((i) => i.slug),
    [customer?.interests],
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(currentSlugs);
  const [saving, setSaving] = useState(false);

  if (!customer) return null;

  const updatedAt = customer.interestsUpdatedAt
    ? new Date(customer.interestsUpdatedAt)
    : null;
  const nextAllowed = updatedAt
    ? new Date(updatedAt.getTime() + ACCOUNT_UPDATE_COOLDOWNS.interestsMs)
    : null;
  const onCooldown = nextAllowed ? nextAllowed.getTime() > Date.now() : false;

  // Order-independent comparison of the draft against the committed set.
  const changed =
    draft.length !== currentSlugs.length ||
    draft.some((s) => !currentSlugs.includes(s));

  const startEditing = () => {
    setDraft(currentSlugs);
    setEditing(true);
  };

  const commit = async () => {
    setSaving(true);
    const res = await callAuthed(
      router,
      (jwt) => updateInterests({ jwt, body: { interestSlugs: draft } }),
      { handleSpecificErrorManually: true },
    );
    setSaving(false);
    if (!res.ok || !res.data) return;
    const data = res.data;
    setCustomer((prev) =>
      prev
        ? {
            ...prev,
            interests: data.interests,
            interestsUpdatedAt: data.interestsUpdatedAt,
          }
        : prev,
    );
    setEditing(false);
  };

  // Interests are 60-day rate-limited, so confirm the change first (same alert as
  // EditableSetting's `confirmLabel`). The value is the chosen interest names.
  const save = () => {
    if (saving || !changed) return;
    const value = draft.length
      ? draft.map((s) => interestName(s)).join(", ")
      : t("interestsEmpty");
    customAlert(
      tc("confirmTitle"),
      tc("confirmBody", { field: t("interestsConfirmLabel"), value }),
      [
        { text: tc("cancel"), style: "cancel" },
        { text: tc("confirmAction"), onPress: () => void commit() },
      ],
    );
  };

  const note =
    onCooldown && nextAllowed
      ? t("interestsCooldown", { date: formatDate(nextAllowed.toISOString()) })
      : undefined;

  const right = editing ? undefined : (
    <AffordancePill
      icon="create-outline"
      label={t("edit")}
      onPress={startEditing}
      disabled={onCooldown}
    />
  );

  return (
    <SettingCard
      icon="pricetags-outline"
      heading={t("interestsHeading")}
      note={note}
      right={right}
    >
      {editing ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: spacing.md }}>
          <InterestsPicker
            value={draft}
            setValue={setDraft}
            maxItems={MAX_INTERESTS}
            placeholder={t("interestsPlaceholder")}
            heading={t("interestsPickerHeading")}
            searchPlaceholder={t("interestsSearch")}
            allLabel={t("interestsAll")}
            doneLabel={t("interestsDone")}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <CustomButton
              type="secondary"
              label={t("cancel")}
              onPress={() => setEditing(false)}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <CustomButton
              type="primary"
              label={t("save")}
              onPress={save}
              loading={saving}
              disabled={!changed}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      ) : currentSlugs.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {currentSlugs.map((slug) => (
            <View
              key={slug}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: color.accent,
              }}
            >
              <Text style={[text.label, { color: color.on.accent }]}>
                {interestName(slug)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[text.bodyMedium, { color: color.text.tertiary }]}>
          {t("interestsEmpty")}
        </Text>
      )}
    </SettingCard>
  );
}
