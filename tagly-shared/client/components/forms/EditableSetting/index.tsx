import { useState } from "react";
import type { KeyboardTypeOptions } from "react-native";
import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeProvider";
import { CustomTextInput } from "../../primitives/CustomTextInput";
import { CustomButton } from "../../primitives/CustomButton";
import {
  AffordancePill,
  SettingCard,
  type SettingIconName,
} from "../SettingCard";
import { customAlert } from "../../feedback/alert";

/**
 * EditableSetting — the reusable text "settings field", shared across apps
 * (customer now, advertiser later). It builds on `SettingCard` (icon + heading +
 * note + animated card) and adds the text-edit behaviour.
 *
 * Two modes, picked by which handler you pass:
 *  - **Inline text edit** (`onSave`): shows the value with an "Edit" pill; tapping
 *    it grows the card open to a `CustomTextInput` + Save/Cancel. Save is blocked
 *    while the value is unchanged or empty-invalid. `onSave` returns whether it
 *    succeeded (false keeps the field open, e.g. after a handled API error).
 *    Optional `validate` gates Save with an inline error.
 *  - **Launch action** (`onAction` + `actionLabel`): shows the value read-only
 *    with an action pill that runs `onAction` (e.g. "Change" → an email flow that
 *    can't be a single inline field).
 *
 * `disabled` + `note` drive the locked/cooldown state (affordance muted + inert,
 * note shown).
 */
export function EditableSetting({
  icon,
  heading,
  subheading,
  value,
  placeholder,
  note,
  disabled = false,
  onSave,
  validate,
  onAction,
  actionLabel,
  actionIcon = "settings-outline",
  editLabel,
  saveLabel,
  cancelLabel,
  confirmLabel,
  keyboardType,
  autoCapitalize = "sentences",
  maxLength,
}: {
  /** Leading icon shown next to the heading. */
  icon?: SettingIconName;
  heading: string;
  subheading?: string;
  /** The current committed value shown when not editing. */
  value: string;
  /** Placeholder for the input and the empty-value hint. */
  placeholder?: string;
  /** Caption under the field — help text or a cooldown message. */
  note?: string;
  /** Locks editing/action (cooldown or otherwise); pair with `note`. */
  disabled?: boolean;
  /** Inline-edit commit. Return false to stay in edit mode (e.g. handled error). */
  onSave?: (next: string) => boolean | Promise<boolean>;
  /** Optional pre-commit validation; return an error message or null. */
  validate?: (next: string) => string | null;
  /** Launch-action handler (e.g. open a change-email flow). */
  onAction?: () => void;
  /** Label for the launch-action pill; required for action mode. */
  actionLabel?: string;
  /** Icon for the launch-action pill (defaults to a forward chevron). */
  actionIcon?: SettingIconName;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  /**
   * When set, Save first shows a confirm alert ("Change {field} to {value}?")
   * naming this field, for one-off / rate-limited changes the user shouldn't make
   * by accident. Pass the field as a lowercase noun (e.g. "referral code").
   */
  confirmLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
}) {
  const { t } = useTranslation("editableSetting");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Can't submit the same value you started with (nor an empty-invalid one).
  const unchanged = draft.trim() === value.trim();

  const startEditing = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const commit = async (next: string) => {
    setSaving(true);
    const ok = (await onSave?.(next)) ?? true;
    setSaving(false);
    if (ok) setEditing(false);
  };

  const save = async () => {
    if (saving || unchanged) return;
    const next = draft.trim();
    const validationError = validate?.(next) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    // Optionally confirm first (one-off / rate-limited fields), naming the field
    // and the new value so an accidental change can't slip through.
    if (confirmLabel) {
      customAlert(
        t("confirmTitle"),
        t("confirmBody", { field: confirmLabel, value: next }),
        [
          { text: cancelLabel ?? t("cancel"), style: "cancel" },
          { text: t("confirmAction"), onPress: () => void commit(next) },
        ],
      );
      return;
    }
    await commit(next);
  };

  // Top-right control: nothing while editing; otherwise the action pill (launch
  // mode) or the "Edit" pill (inline mode).
  const right = editing ? null : onAction ? (
    <AffordancePill
      icon={actionIcon}
      label={actionLabel ?? ""}
      onPress={onAction}
      disabled={disabled}
    />
  ) : onSave ? (
    <AffordancePill
      icon="create-outline"
      label={editLabel ?? t("edit")}
      onPress={startEditing}
      disabled={disabled}
    />
  ) : undefined;

  return (
    <SettingCard
      icon={icon}
      heading={heading}
      subheading={subheading}
      note={note}
      right={right}
    >
      {editing ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{ gap: spacing.md }}
        >
          <CustomTextInput
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            error={error ?? undefined}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
            autoFocus
            onSubmitEditing={save}
            returnKeyType="done"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <CustomButton
              type="secondary"
              label={cancelLabel ?? t("cancel")}
              onPress={cancel}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <CustomButton
              type="primary"
              label={saveLabel ?? t("save")}
              onPress={save}
              loading={saving}
              disabled={unchanged}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      ) : (
        <Text
          style={[
            text.bodyMedium,
            { color: value ? color.text.primary : color.text.tertiary },
          ]}
        >
          {value || placeholder}
        </Text>
      )}
    </SettingCard>
  );
}
