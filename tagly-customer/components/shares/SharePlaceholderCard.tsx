import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@tagly/client";

// 9:16 ≈ 0.5625 — the ratio ~all shares (stories) use, so a placeholder matches
// the height of the real cards it sits beside.
const DEFAULT_ASPECT_RATIO = 0.5625;

/**
 * SharePlaceholderCard — a non-interactive filler that mirrors a
 * `SharePreviewCard`'s footprint, so the account "Your shares" strip always fills
 * the screen width even when the customer has few (or no) shares yet. A plain
 * surface card (matching the real cards' lift) with a muted image icon that reads
 * as "a share will appear here."
 */
export default function SharePlaceholderCard({ width }: { width: number }) {
  const { theme } = useTheme();
  const { color, radius, shadow } = theme;
  const height = Math.round(width / DEFAULT_ASPECT_RATIO);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius.structure,
        backgroundColor: color.surface,
        boxShadow: shadow.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="image-outline" size={28} color={color.text.tertiary} />
    </View>
  );
}
