import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { submitSupport } from "@tagly/sdk/v2/crossApp";
import { useTheme } from "../../../theme/ThemeProvider";
import { callAuthed } from "../../../api/caller";
import { BottomSheet } from "../../overlays/BottomSheet";
import { CustomButton } from "../../primitives/CustomButton";
import { CustomTextInput } from "../../primitives/CustomTextInput";
import { showToast } from "../../feedback/toast";

/** Hard cap on a support message — matches `SubmitSupportBodySchema` (2000). */
const MAX_LENGTH = 2000;

/**
 * Contact-support sheet — a bottom sheet with a multiline box for the user to
 * describe an issue (e.g. appeal a ban), plus a Send action. General-purpose:
 * the optional `context` tag is forwarded to the team email so support knows
 * where the request came from without the user explaining it. Lives in
 * `@tagly/client` so both apps reuse it (posts to `POST /v2/cross/support`,
 * which accepts either app's JWT and emails the team — the reply comes by
 * email, which the copy makes explicit).
 */
export function SupportSheet({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional origin tag (e.g. "banned-account") surfaced in the team email. */
  context?: string;
}) {
  const { t } = useTranslation("support");
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
      submitSupport({
        body: { message: trimmed, ...(context ? { context } : {}) },
        jwt,
      }),
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
