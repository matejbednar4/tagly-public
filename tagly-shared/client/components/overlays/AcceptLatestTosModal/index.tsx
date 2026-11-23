import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { BottomSheet } from "../BottomSheet";
import { CustomButton } from "../../primitives/CustomButton";
import { PressableText } from "../../primitives/PressableText";
import { callAuthed } from "../../../api/caller";
import { openTermsOfService } from "../../../services/links/openTermsOfService";
import { agreeWithTos } from "@tagly/sdk/v2/crossApp";

/**
 * Blocking app-open modal shown when the Terms of Service have been updated
 * (the `shouldAgreeWithLatestTos` gate on `GET /me` is true). Not dismissable —
 * `BottomSheet` gets no `onClose`, so there is no backdrop tap / swipe out; the
 * user must explicitly tick the consent box and accept to continue.
 *
 * On accept it stamps the agreed-at timestamp via `POST /v2/cross/…/agree`
 * (either app's JWT works — this lives in `@tagly/client` so the advertiser app
 * can reuse it), then calls `onFinished` so the host layout advances its modal
 * cycle. Shared with {@link AcceptLatestPrivacyPolicyModal}.
 */
export function AcceptLatestTosModal({
  open,
  onFinished,
}: {
  open: boolean;
  onFinished: () => void;
}) {
  const { t } = useTranslation("acceptTos");
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const router = useRouter();

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      const result = await callAuthed(router, (jwt) => agreeWithTos({ jwt }));
      if (!result.ok) {
        // callAuthed already surfaced the error; keep the modal up to retry.
        return;
      }
      onFinished();
    } finally {
      // This modal is mounted for the whole authed session with no dismissal
      // path, so a leaked `submitting` would disable its only button forever —
      // reset on every exit, including an unexpected throw.
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("body")}
          </Text>
        </View>

        {/* The whole row toggles via the Pressable; the nested PressableText
            "Terms of Service" is its own tappable run that opens the doc instead
            of toggling. Same pattern as the create-share consent row. */}
        <Pressable
          onPress={() => setAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          hitSlop={8}
          style={({
            pressed,
            hovered,
          }: {
            pressed: boolean;
            hovered?: boolean;
          }) => [
            { flexDirection: "row", alignItems: "center", gap: spacing.md },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: radius.button,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: agreed ? color.ink : color.surface,
              borderWidth: agreed ? 0 : 1.5,
              borderColor: color.border.strong,
            }}
          >
            {agreed && (
              <Ionicons name="checkmark" size={16} color={color.on.ink} />
            )}
          </View>
          <Text
            style={[text.caption, { color: color.text.primary, flex: 1 }]}
          >
            <Trans
              t={t}
              i18nKey="agreeLine"
              components={{
                terms: (
                  <PressableText
                    onPress={openTermsOfService}
                    style={text.caption}
                  />
                ),
              }}
            />
          </Text>
        </Pressable>

        <CustomButton
          type="primary"
          label={t("agree")}
          onPress={handleAccept}
          loading={submitting}
          disabled={!agreed || submitting}
        />
      </View>
    </BottomSheet>
  );
}
