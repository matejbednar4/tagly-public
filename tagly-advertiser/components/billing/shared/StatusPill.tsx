import { View, Text } from "react-native";
import { useTheme, withAlpha } from "@tagly/client";

/**
 * The one status pill for every funding surface — rows, card faces and sheet
 * headers alike, so "Active" / "Paused" never render two different ways. Tone
 * is semantic, never decorative: success = running, danger = needs the
 * advertiser, neutral = deliberately off.
 */
export type StatusTone = "success" | "danger" | "neutral";

export function StatusPill({
  label,
  tone,
  size = "md",
}: {
  label: string;
  tone: StatusTone;
  /** `sm` (micro type) for dense rows; `md` for a sheet header. */
  size?: "sm" | "md";
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const bg =
    tone === "success"
      ? color.successBg
      : tone === "danger"
        ? color.dangerBg
        : withAlpha(color.ink, 0.08);
  const fg =
    tone === "success"
      ? color.on.successBg
      : tone === "danger"
        ? color.on.dangerBg
        : color.text.secondary;
  return (
    <View
      style={{
        paddingVertical: size === "sm" ? 2 : spacing.xs,
        paddingHorizontal: size === "sm" ? spacing.sm : spacing.md,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      <Text style={[size === "sm" ? text.micro : text.label, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}
