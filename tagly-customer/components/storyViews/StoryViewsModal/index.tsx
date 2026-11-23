import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BottomSheet,
  callAuthed,
  CustomButton,
  CustomTextInput,
  useBusinessMapCache,
  useTheme,
} from "@tagly/client";
import { updateEstimatedStoryViews } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * Asks a customer with no linked Instagram how many people typically see their
 * story. The answer is SERVER-OWNED (`Customer.estimatedStoryViews`, E062) —
 * the backend prices estimates from it — so Save writes the endpoint and
 * patches the cached customer; there is no local copy anywhere. On a failed
 * save the sheet stays open (callAuthed has already alerted).
 *
 * Shown by the app-open modal cycle once per cold start (until the customer
 * enters a number, skips, or connects Instagram). It's a nudge, not a gate:
 *   - Save → server write + customer patch + map-cache reset so estimates refresh.
 *   - Skip → `onSkip` (the host persists the local skip flag).
 * `allowCancel` (e.g. opened from settings) swaps Skip for a plain Cancel that
 * touches nothing. `onClose` fires after any exit so the host clears it.
 */
export default function StoryViewsModal({
  open,
  onClose,
  onSkip,
  allowCancel = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Persisted skip handled by the host; required unless `allowCancel`. */
  onSkip?: () => void;
  allowCancel?: boolean;
}) {
  const { t } = useTranslation("storyViews");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const { setCustomer } = useCustomer();
  const { resetCache } = useBusinessMapCache();

  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = parseInt(input.replace(/[^0-9]/g, ""), 10);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const res = await callAuthed(router, (jwt) =>
        updateEstimatedStoryViews({
          jwt,
          body: { estimatedStoryViews: parsed },
        }),
      );
      if (!res.ok) return; // alerted centrally; keep the sheet open
      // Every consumer reads the cached customer — patch it so estimates and
      // the nudge gate flip without a /me refetch.
      setCustomer((prev) =>
        prev ? { ...prev, estimatedStoryViews: parsed } : prev,
      );
      resetCache();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSecondary = () => {
    if (saving) return;
    if (!allowCancel) onSkip?.();
    onClose();
  };

  return (
    <BottomSheet open={open}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("subtitle")}
          </Text>
        </View>

        <CustomTextInput
          insideHeading={t("inputHeading")}
          placeholder={t("inputPlaceholder")}
          value={input}
          onChangeText={(val) => setInput(val.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
        />

        <View style={{ gap: spacing.sm }}>
          <CustomButton
            type="primary"
            label={t("submitButton")}
            onPress={handleSave}
            loading={saving}
            disabled={!isValid || saving}
          />
          <CustomButton
            type="secondary"
            label={allowCancel ? t("cancelButton") : t("skipButton")}
            onPress={handleSecondary}
            disabled={saving}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
