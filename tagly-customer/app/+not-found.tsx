import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { CustomButton, useTheme } from "@tagly/client";

/**
 * Global 404 fallback for any unmatched route. A faint oversized "404" watermark
 * behind a short heading and a single CTA that either goes back (if there's a
 * stack) or resets to the app root — `/` gates `(app)` vs `(onboarding)` on JWT,
 * so "go home" lands the user wherever they belong without knowing their auth state.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation("notFound");
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.background,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.layout.screenPadding,
      }}
    >
      {/* Oversized 404 watermark behind the content */}
      <Text
        style={[
          theme.text.display,
          {
            position: "absolute",
            fontSize: 240,
            lineHeight: 240,
            letterSpacing: -4,
            color: theme.color.ink,
            opacity: 0.1,
          },
        ]}
      >
        404
      </Text>

      {/* Foreground content */}
      <View style={{ alignItems: "center", gap: theme.spacing.xl }}>
        <Text
          style={[
            theme.text.title,
            { color: theme.color.text.primary, textAlign: "center" },
          ]}
        >
          {t("notFoundHeading")}
        </Text>
        <CustomButton
          type="primary"
          label={router.canGoBack() ? t("goBack") : t("goHome")}
          icon={router.canGoBack() ? "arrow-back" : "home"}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      </View>
    </View>
  );
}
