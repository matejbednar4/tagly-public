import { View, Text, Linking } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { CustomButton } from "./primitives/CustomButton";

/**
 * Blocking screen shown when the backend reports the client is outdated (426).
 * Minimal copy; sends the user to the store. Shared across apps.
 */
export function UpdateRequiredScreen({ storeUrl }: { storeUrl: string }) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.lg,
        padding: layout.screenPadding,
        backgroundColor: color.background,
      }}
    >
      <Text
        style={[text.display, { color: color.text.primary, textAlign: "center" }]}
      >
        Update Tagly
      </Text>
      <Text
        style={[text.body, { color: color.text.secondary, textAlign: "center" }]}
      >
        A new version is required to continue.
      </Text>
      <CustomButton
        type="primary"
        label="Update"
        onPress={() => Linking.openURL(storeUrl)}
        style={{ alignSelf: "stretch" }}
        icon="cloud-download-outline"
      />
    </View>
  );
}
