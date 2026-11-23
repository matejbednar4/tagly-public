import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
import { spacing, layout } from "../../theme/theme";
import { CustomMediaType } from "./CustomMedia.native";
import { ZoomableMedia } from "./ZoomableMedia.native";

/**
 * Fullscreen, swipeable media lightbox. Open it with a non-null `media` array and
 * an `initialIndex`; the user pages horizontally between items, double-tap /
 * pinch to zoom (paging is disabled while an item is zoomed so the drag pans the
 * image instead), and closes via the X button. A dark backdrop + white controls
 * is the standard lightbox treatment.
 *
 * Each page is a shared `ZoomableMedia`. `CustomMedia` opens this with a
 * single-item array for its tap/long-press fullscreen, so the single-item and
 * multi-item lightbox share one implementation.
 */
export function FullscreenMediaGallery({
  media,
  initialIndex = 0,
  onClose,
}: {
  media: CustomMediaType[] | null;
  initialIndex?: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  if (!media || media.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
        <FlatList
          data={media}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          keyExtractor={(_, i) => String(i)}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndex((prev) => (prev !== i ? i : prev));
          }}
          renderItem={({ item }) => (
            <ZoomableMedia
              media={item}
              width={width}
              height={height}
              onZoomChange={setZoomed}
              onRequestClose={onClose}
            />
          )}
        />

        {/* Close */}
        <Pressable
          onPress={onClose}
          hitSlop={spacing.md}
          style={{
            position: "absolute",
            top: insets.top + spacing.sm,
            right: layout.screenPadding,
            width: layout.minTapTarget,
            height: layout.minTapTarget,
            borderRadius: theme.radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {/* Index dots */}
        {media.length > 1 && (
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + spacing.lg,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.xs,
            }}
          >
            {media.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: theme.radius.pill,
                  backgroundColor:
                    i === index ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}
