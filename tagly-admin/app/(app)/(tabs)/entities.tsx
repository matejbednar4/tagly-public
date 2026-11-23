import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, CustomButton, TopMenu } from "@tagly/client";
import { useLogoutAction } from "@/hooks/useLogoutAction";

/**
 * Entities tab — a simple hub. Two ways into the data, each its own
 * single-purpose screen (pushed over the tab bar): Search (fuzzy across every
 * type) and List (browse by type, paginated).
 */
export default function EntitiesScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const logoutAction = useLogoutAction();

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Entities" rightAction={logoutAction} />
      <View
        style={{
          flex: 1,
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
        }}
      >
        <Text style={[text.body, { color: color.text.secondary }]}>
          Browse or search every record.
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <CustomButton
          type="soft"
          label="Search"
          icon="search-outline"
          iconPosition="trailing"
          onPress={() => router.push("/entities/search")}
        />
        <CustomButton
          type="soft"
          label="List"
          icon="list-outline"
          iconPosition="trailing"
          onPress={() => router.push("/entities/list")}
        />
        </View>
      </View>
    </View>
  );
}
