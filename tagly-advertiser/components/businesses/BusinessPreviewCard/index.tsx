import { View, Text, Image, Pressable } from "react-native";
import {
  useTheme,
  withQualityCdnUrlFromKey,
  pressFeedbackStyle,
  useCatalogLocalizer,
} from "@tagly/client";
import type { BusinessOwnerPreview } from "@tagly/models/v2/advertiserApp";

/**
 * BusinessPreviewCard — one of the advertiser's own business pages as a
 * fixed-width strip card: the 16:9 banner with the name/type/city under it.
 * Presentational; the parent supplies the `width` and an optional `onPress`
 * (omitted until the owner business-detail screen exists — the card then
 * renders inert). The type name is resolved from the shared catalog by slug
 * (localized).
 */
export function BusinessPreviewCard({
  business,
  width,
  onPress,
}: {
  business: BusinessOwnerPreview;
  width: number;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;
  const { typeName } = useCatalogLocalizer();

  const uri = withQualityCdnUrlFromKey(business.banner.key, { w: 600 });

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { width, gap: spacing.sm },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View
        style={{
          width,
          aspectRatio: 16 / 9,
          borderRadius: radius.structure,
          overflow: "hidden",
          backgroundColor: color.surface,
          boxShadow: shadow.card,
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          style={[text.bodyMedium, { color: color.text.primary }]}
          numberOfLines={1}
        >
          {business.name}
        </Text>
        <Text
          style={[text.caption, { color: color.text.secondary }]}
          numberOfLines={1}
        >
          {typeName(business.type.slug)}
          {" · "}
          {business.city}
        </Text>
      </View>
    </Pressable>
  );
}
