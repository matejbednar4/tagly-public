import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { submitFeedback } from "@tagly/sdk/v2/crossApp";
import { useTheme } from "../../../theme/ThemeProvider";
import { callAuthed } from "../../../api/caller";
import { BottomSheet } from "../../overlays/BottomSheet";
import { CustomButton } from "../../primitives/CustomButton";
import { CustomTextInput } from "../../primitives/CustomTextInput";
import { showToast } from "../toast";

/** Hard cap on a feedback message — keeps the payload sane + the box bounded. */
const MAX_LENGTH = 1000;

/**
 * In-app feedback sheet — a bottom sheet with a multiline box for the user to
 * share feedback or request a feature, plus a Send action. Opened from each
 * app's Account profile header "Provide feedback" tile (and the customer
 * drawer). Posts to `POST /v2/cross/feedback` (either app's JWT works — this
 * lives in `@tagly/client` so both apps reuse it), which emails the submission
 * to the team.
 */
export function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("feedback");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && !submitting;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    const result = await callAuthed(router, (jwt) =>
      submitFeedback({ body: { message: trimmed }, jwt }),
    );
    setSubmitting(false);
    if (!result.ok) return; // callAuthed already surfaced the error
    setMessage("");
    onClose();
    showToast({
      type: "success",
      text1: t("sentToastTitle"),
      text2: t("sentToastBody"),
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {t("subtitle")}
          </Text>
        </View>

        <View style={{ gap: spacing.xs }}>
          <CustomTextInput
            placeholder={t("placeholder")}
            value={message}
            onChangeText={setMessage}
            multiline
            height={140}
            maxLength={MAX_LENGTH}
          />
          <Text
            style={[
              text.micro,
              { color: color.text.tertiary, alignSelf: "flex-end" },
            ]}
          >
            {message.length}/{MAX_LENGTH}
          </Text>
        </View>

        <CustomButton
          type="primary"
          label={t("send")}
          onPress={handleSend}
          loading={submitting}
          disabled={!canSend}
        />
      </View>
    </BottomSheet>
  );
}
