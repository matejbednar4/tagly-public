import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  AffordancePill,
  callAuthed,
  CustomButton,
  pressFeedbackStyle,
  SettingCard,
  useTheme,
} from "@tagly/client";
import type { Gender } from "@tagly/models/shared";
import { updateGender } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * Gender field on the Profile screen — shows the current value with an "Edit"
 * pill (like the other fields); tapping it grows the card open to three
 * single-select chips + Save/Cancel. Save is blocked while the choice is
 * unchanged. Gender has no cooldown, so it can be changed freely. Reads + writes
 * the shared `useCustomer` context.
 */
export function GenderField() {
  const { t } = useTranslation("settingsProfile");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;
  const { customer, setCustomer } = useCustomer();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Gender>(customer?.gender ?? "UNSPECIFIED");
  const [saving, setSaving] = useState(false);

  if (!customer) return null;

  const options: { value: Gender; label: string }[] = [
    { value: "MALE", label: t("male") },
    { value: "FEMALE", label: t("female") },
    { value: "UNSPECIFIED", label: t("unspecified") },
  ];
  const labelFor = (g: Gender) =>
    options.find((o) => o.value === g)?.label ?? "";

  const changed = draft !== customer.gender;

  const startEditing = () => {
    setDraft(customer.gender);
    setEditing(true);
  };

  const save = async () => {
    if (saving || !changed) return;
    setSaving(true);
    const res = await callAuthed(
      router,
      (jwt) => updateGender({ jwt, body: { gender: draft } }),
      { handleSpecificErrorManually: true },
    );
    setSaving(false);
    if (!res.ok || !res.data) return;
    const data = res.data;
    setCustomer((prev) =>
      prev
        ? { ...prev, gender: data.gender, genderUpdatedAt: data.genderUpdatedAt }
        : prev,
    );
    setEditing(false);
  };

  const right = editing ? undefined : (
    <AffordancePill
      icon="create-outline"
      label={t("edit")}
      onPress={startEditing}
      disabled={false}
    />
  );

  return (
    <SettingCard
      icon="male-female-outline"
      heading={t("genderHeading")}
      right={right}
    >
      {editing ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {options.map((o) => {
              const selected = draft === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setDraft(o.value)}
                  style={({
                    pressed,
                    hovered,
                  }: {
                    pressed: boolean;
                    hovered?: boolean;
                  }) => [
                    {
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.pill,
                      backgroundColor: selected ? color.ink : color.surface,
                      boxShadow: shadow.chip,
                    },
                    pressFeedbackStyle({ pressed, hovered }),
                  ]}
                >
                  <Text
                    style={[
                      text.label,
                      { color: selected ? color.on.ink : color.text.primary },
                    ]}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
      ) : (
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {labelFor(customer.gender)}
        </Text>
      )}
    </SettingCard>
  );
}
