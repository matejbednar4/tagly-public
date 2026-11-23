import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, CustomButton, TopMenu } from "@tagly/client";
import { useLogoutAction } from "@/hooks/useLogoutAction";

/**
 * Manage tab — the admin tools hub (same shape as the Entities hub): each tool
 * is its own pushed screen. Tools: create a business page (unowned /
 * subsidized-track) and the notification
 * blast (compose + history; revived 2026-08-13). More land here as the Manage
 * slice grows (subsidize, bans, credits).
 */
export default function ManageScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const logoutAction = useLogoutAction();

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Manage" rightAction={logoutAction} />
      <View
        style={{
          flex: 1,
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
        }}
      >
        <Text style={[text.body, { color: color.text.secondary }]}>
          Admin tools. Every action here changes live data.
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <CustomButton
            type="soft"
            label="Create business page"
            icon="storefront-outline"
            iconPosition="trailing"
            onPress={() => router.push("/businesses/create")}
          />
          <CustomButton
            type="soft"
            label="Send blast"
            icon="megaphone-outline"
            iconPosition="trailing"
            onPress={() => router.push("/notifications/blast")}
          />
          <CustomButton
            type="soft"
            label="Blast history"
            icon="time-outline"
            iconPosition="trailing"
            onPress={() => router.push("/notifications/blasts")}
          />
        </View>
      </View>
    </View>
  );
}
