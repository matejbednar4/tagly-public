import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  View,
} from "react-native";
import Video from "react-native-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { withQualityCdnUrlFromKey } from "../../utils/media/withQualityCdnUrlFromKey";
import { CustomMediaType } from "./CustomMedia.native";

const DOUBLE_TAP_SCALE = 2.5;

/**
 * One media item rendered to fit a `width × height` viewport (contain), with
 * **double-tap to toggle zoom** (centered) and **swipe-down to dismiss** (when not
 * zoomed). Pinch and pan were intentionally removed (pinch was buggy); a single
 * tap deliberately does nothing.
 *
 * `onZoomChange` reports whether the item is currently zoomed so a parent pager
 * can disable horizontal paging while zoomed. `onRequestClose` powers the
 * swipe-down dismiss.
 *
 * Used by `FullscreenMediaGallery` (which `CustomMedia` opens with a single-item
 * array for tap/long-press fullscreen, or a multi-item array for a swipeable
 * gallery) so the zoom/render behaviour lives in exactly one place.
 */
export function ZoomableMedia({
  media,
  width,
  height,
  onRequestClose,
  onZoomChange,
}: {
  media: CustomMediaType;
  width: number;
  height: number;
  onRequestClose?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);

  const scale = useSharedValue(1);
  const ty = useSharedValue(0); // swipe-down-to-dismiss drag only

  // Mirror zoom state to JS so the gesture set (and a parent pager) can react.
  const [zoomed, setZoomed] = useState(false);
  const reportZoom = (z: boolean) => {
    setZoomed(z);
    onZoomChange?.(z);
  };
  useAnimatedReaction(
    () => scale.value > 1.01,
    (z, prev) => {
      if (z !== prev) scheduleOnRN(reportZoom, z);
    },
  );

  // Zoom is double-tap only (centered) — pinch was removed (buggy). No panning.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value =
        scale.value > 1 ? withTiming(1) : withTiming(DOUBLE_TAP_SCALE);
    });

  // Swipe down to dismiss — only when not zoomed, failing on horizontal movement
  // so a parent pager still pages sideways. A single tap deliberately does NOT
  // close (that made zooming impossible).
  const dismiss = Gesture.Pan()
    .enabled(!zoomed && !!onRequestClose)
    .activeOffsetY(20)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY > 0) ty.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 140 && onRequestClose) {
        scheduleOnRN(onRequestClose);
      } else {
        ty.value = withTiming(0);
      }
    });

  const composed = Gesture.Simultaneous(dismiss, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  const uri =
    "key" in media
      ? withQualityCdnUrlFromKey(media.key)
      : "url" in media
        ? media.url
        : undefined;
  const imageSource: ImageSourcePropType | undefined =
    media.type === "IMAGE"
      ? "source" in media
        ? media.source
        : uri
          ? { uri }
          : undefined
      : undefined;

  return (
    <GestureDetector gesture={composed}>
      <View
        style={{
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View style={[{ width, height }, animatedStyle]}>
          {media.type === "IMAGE" && imageSource && (
            <Image
              source={imageSource}
              resizeMode="contain"
              style={{ width, height }}
              onLoadEnd={() => setLoading(false)}
            />
          )}
          {media.type === "VIDEO" && uri && (
            <Video
              source={{ uri }}
              resizeMode="contain"
              style={{ width, height }}
              controls
              onLoad={() => setLoading(false)}
            />
          )}
        </Animated.View>
        {loading && (
          <ActivityIndicator style={{ position: "absolute" }} color="#fff" />
        )}
      </View>
    </GestureDetector>
  );
}
