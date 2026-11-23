import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  Animated,
  Text,
  Easing,
  ImageSourcePropType,
} from "react-native";
import Video from "react-native-video";
import { MediaPreview } from "@tagly/models/v2/crossApp";
import { FullscreenMediaGallery } from "./FullscreenMediaGallery.native";
import { useTheme } from "../../theme/ThemeProvider";
import { withAlpha } from "../../theme/colorUtils";
import { withQualityCdnUrlFromKey } from "../../utils/media/withQualityCdnUrlFromKey";
import Ionicons from "@expo/vector-icons/Ionicons";

const loadedCache = new Map<string, boolean>(); // url -> loaded once

// Auto-retry for flaky remote loads (IG CDN especially): after a load error the
// media view is remounted for a fresh native fetch, with a short backoff.
const RETRY_DELAYS_MS = [1000, 3000]; // attempt 1 → +1s, attempt 2 → +3s

export type CustomMediaType =
  | MediaPreview
  | { url: string; type: "IMAGE" | "VIDEO"; aspectRatio: number }
  | {
      source: ImageSourcePropType;
      type: "IMAGE" | "VIDEO";
      aspectRatio: number;
    };

// Narrow type for react-native-video source
type VideoSource = { uri?: string | NodeRequire };

/**
 * Renders an image/video tile (with an optional fullscreen preview on tap).
 *
 * Loading behavior: a spinner shows until the media reports ready. A load
 * error auto-retries twice (1s, 3s backoff) by remounting the native view for
 * a fresh fetch — IG CDN URLs are flaky — and only a genuine success marks the
 * URL in the loaded cache. When retries are exhausted the spinner swaps for a
 * quiet broken-media glyph (never an eternal spinner, never a silent blank);
 * the next mount of the same URL starts a fresh attempt.
 *
 * ⚠️ Making it tappable — read this, it bites everyone: CustomMedia ALWAYS
 * renders its own touchable wrapper (`TouchableOpacity` here, `Pressable` on
 * web). To respond to a tap, pass `onPress` to CustomMedia itself. Do NOT wrap
 * CustomMedia in your own `Pressable` / `TouchableOpacity` — the outer touchable
 * loses the responder fight with the inner one and your press is silently
 * swallowed. For a card whose whole surface is tappable, give `onPress` to
 * CustomMedia and keep the surrounding container a plain `View`
 * (see `BusinessPreview` / `InstagramStoryPreview`).
 *
 * With no `onPress`: a tap opens the fullscreen preview, unless
 * `disableFullscreenPreview` is set — in which case taps are inert (so passing
 * `disableFullscreenPreview` WITHOUT `onPress` makes the tile do nothing on tap).
 * `disablePress` goes further: it disables the touchable itself, so the tile
 * shows no press feedback at all (a purely informational tile).
 */
export function CustomMedia({
  media,
  thumbnail,
  renderVideo = false,
  onPress,
  onLongPress,
  style,
  disableFullscreenPreview = false,
  disablePress = false,
  backgroundColor,
  children,
  quality,
  deletedMessage,
  unavailableMessage,
}: {
  media: CustomMediaType;
  thumbnail?: MediaPreview | null;
  renderVideo?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disableFullscreenPreview?: boolean;
  disablePress?: boolean;
  backgroundColor?: string;
  children?: ReactNode;
  quality?: number;
  deletedMessage?: string;
  /**
   * Shown (same quiet placeholder as deleted media) when the media has NO
   * source to render — an empty/missing url. Without it, a source-less tile
   * settles into a spinner with nothing behind it. Used for Instagram stories
   * whose media the Graph API withholds (copyright-flagged, e.g. a music
   * sticker).
   */
  unavailableMessage?: string;
}) {
  const { theme } = useTheme();
  const { color, text } = theme;
  const [fullscreenPreview, setFullscreenPreview] =
    useState<CustomMediaType | null>(null);
  const [duration, setDuration] = useState(0);

  const willRenderVideo =
    (renderVideo && media.type === "VIDEO") ||
    (media.type === "VIDEO" && !thumbnail);

  // deleted media detection
  const isDeletedMedia = useMemo(() => {
    if ("key" in media) {
      return media.key.startsWith("deleted/");
    }
    return false;
  }, [media]);

  const remoteUrl = useMemo(() => {
    if ("key" in media) {
      if (willRenderVideo || media.type === "IMAGE" || !thumbnail) {
        return withQualityCdnUrlFromKey(media.key, { quality });
      }

      return withQualityCdnUrlFromKey(thumbnail.key, { quality });
    }

    if ("url" in media) {
      return media.url;
    }

    return null;
  }, [media, thumbnail, willRenderVideo, quality]);

  const imageSource: ImageSourcePropType | undefined = useMemo(() => {
    if ("source" in media) {
      return media.source;
    }

    if (remoteUrl) {
      return { uri: remoteUrl };
    }

    return undefined;
  }, [media, remoteUrl]);

  const videoSource: VideoSource | undefined = useMemo(() => {
    if (!willRenderVideo) {
      return undefined;
    }

    if ("source" in media) {
      return media.source as VideoSource;
    }

    if (remoteUrl) {
      return { uri: remoteUrl };
    }

    return undefined;
  }, [media, willRenderVideo, remoteUrl]);

  const cacheKey = remoteUrl ?? null;
  const initiallyCached = cacheKey ? !!loadedCache.get(cacheKey) : true;

  const mediaOpacity = useRef(
    new Animated.Value(initiallyCached ? 1 : 0),
  ).current;
  const childOpacity = useRef(
    new Animated.Value(initiallyCached ? 1 : 0),
  ).current;

  const wasCachedRef = useRef(initiallyCached);

  useEffect(() => {
    const cached = cacheKey ? !!loadedCache.get(cacheKey) : true;
    wasCachedRef.current = cached;

    mediaOpacity.setValue(cached ? 1 : 0);
    childOpacity.setValue(cached ? 1 : 0);
  }, [cacheKey, mediaOpacity, childOpacity]);

  const fadeMediaIfNeeded = () => {
    if (!wasCachedRef.current) {
      Animated.timing(mediaOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }).start(() => {
        wasCachedRef.current = true;
      });
    } else {
      mediaOpacity.setValue(1);
    }
  };

  const fadeChildren = () => {
    childOpacity.setValue(0);
    Animated.timing(childOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const readyCalledRef = useRef(false);

  // Auto-retry state: `attempt` keys the media view so bumping it remounts the
  // native image/video and forces a fresh fetch; `failed` means every retry was
  // exhausted (spinner swaps for a quiet broken-media glyph).
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settle the tile visually (fade layers in). Deliberately does NOT touch
  // `loadedCache` — only a genuine successful load may mark a URL as loaded,
  // otherwise a failed/timed-out URL would skip the spinner on its next mount
  // and render as a silent blank tile.
  const settle = () => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;

    fadeMediaIfNeeded();
    fadeChildren();
  };

  const onMediaLoaded = () => {
    if (cacheKey) {
      loadedCache.set(cacheKey, true);
    }
    // A late retry can succeed after the timeout fallback already settled —
    // always clear the failure glyph on a real load.
    if (failed) setFailed(false);
    settle();
  };

  // Load error → remount for a fresh fetch (short backoff); after the last
  // retry, give up visibly: stop the spinner and show the broken-media glyph.
  // The next mount of the same URL starts over (nothing is cached on failure).
  const onMediaError = () => {
    const next = attemptRef.current + 1;
    if (next <= RETRY_DELAYS_MS.length) {
      retryTimerRef.current = setTimeout(() => {
        attemptRef.current = next;
        setAttempt(next);
      }, RETRY_DELAYS_MS[next - 1]);
      return;
    }
    setFailed(true);
    settle();
  };

  // Reset ready flag + retry state when cache key changes (new media)
  useEffect(() => {
    readyCalledRef.current = false;
    attemptRef.current = 0;
    setAttempt(0);
    setFailed(false);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [cacheKey]);

  // Timeout fallback: if media doesn't load within 10s, settle the tile anyway
  // (a still-pending load that finishes later fades in via onMediaLoaded).
  useEffect(() => {
    if (wasCachedRef.current) return;

    const timeout = setTimeout(() => {
      settle();
    }, 10000);

    return () => clearTimeout(timeout);
  }, [cacheKey]);

  // If no source to render, settle immediately
  useEffect(() => {
    const hasSource = willRenderVideo ? !!videoSource : !!imageSource;
    if (!hasSource && !isDeletedMedia) {
      settle();
    }
  }, [willRenderVideo, videoSource, imageSource, isDeletedMedia]);

  // Quiet neutral placeholder behind loading/deleted media, anchored to ink.
  if (!backgroundColor) {
    backgroundColor = color.surface;
  }

  // Placeholder states, same layout with per-state styling: deleted media (a
  // quiet tertiary note), or media with no source to render at all
  // (`unavailableMessage` — Instagram withholds a copyright-flagged story's
  // media; a danger mark, since the user must act to fix it). Keeps aspect
  // ratio + children.
  const hasSource = willRenderVideo ? !!videoSource : !!imageSource;
  const placeholder = isDeletedMedia
    ? {
        icon: "image" as const,
        iconColor: color.text.tertiary,
        message: deletedMessage || "This image was deleted from Tagly",
      }
    : !hasSource && unavailableMessage
      ? {
          icon: "alert-circle" as const,
          iconColor: color.danger,
          message: unavailableMessage,
        }
      : null;
  if (placeholder) {
    return (
      <>
        <TouchableOpacity
          style={[
            style,
            {
              backgroundColor,
              overflow: "hidden",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
          activeOpacity={0.8}
          disabled={disablePress}
          onPress={onPress}
        >
          <Ionicons
            name={placeholder.icon}
            size={32}
            color={placeholder.iconColor}
          />
          <Text
            style={[
              text.micro,
              {
                color: color.text.tertiary,
                textAlign: "center",
                maxWidth: "80%",
                marginTop: 4,
              },
            ]}
          >
            {placeholder.message}
          </Text>
          <View style={[StyleSheet.absoluteFill]} pointerEvents="box-none">
            {children}
          </View>
        </TouchableOpacity>
      </>
    );
  }

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
      return;
    }
    if (disableFullscreenPreview) {
      return;
    }

    setFullscreenPreview(media);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (disableFullscreenPreview) {
      return;
    }

    setFullscreenPreview(media);
  };

  return (
    <>
      <TouchableOpacity
        style={[style, { backgroundColor, overflow: "hidden" }]}
        activeOpacity={0.8}
        disabled={disablePress}
        onLongPress={handleLongPress}
        onPress={handlePress}
      >
        {/* Always-mounted spinner behind; swaps for a quiet broken-media glyph
            once every auto-retry is exhausted (never an eternal spinner). */}
        <View
          style={[StyleSheet.absoluteFill, styles.center]}
          pointerEvents="none"
        >
          {failed ? (
            <Ionicons
              name="image-outline"
              size={24}
              color={color.text.tertiary}
            />
          ) : (
            <ActivityIndicator color={color.text.tertiary} />
          )}
        </View>

        {/* Media layer. Purely visual (autoplaying muted video / image, no
            controls), so on Android it must not take touches: react-native-
            video's native view consumes the touch stream there, which ate the
            tap before the owning TouchableOpacity saw it (video stories in the
            share picker couldn't be selected). iOS keeps the default. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: mediaOpacity }]}
          pointerEvents={Platform.OS === "android" ? "none" : undefined}
        >
          {willRenderVideo && videoSource ? (
            <Video
              key={attempt}
              source={videoSource}
              style={[StyleSheet.absoluteFill, styles.center]}
              resizeMode="cover"
              repeat
              muted
              onLoad={(meta) => {
                const d = Math.round((meta?.duration as number) ?? 0);
                setDuration(Number.isFinite(d) ? d : 0);
              }}
              onReadyForDisplay={onMediaLoaded}
              onError={onMediaError}
              volume={0}
              mixWithOthers="mix"
              ignoreSilentSwitch="obey"
              disableFocus={true}
              playInBackground={false}
              playWhenInactive={false}
            >
              {duration > 0 && (
                <Text
                  style={[
                    text.micro,
                    {
                      color: "#FFFFFF",
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                    },
                  ]}
                >
                  {duration}s
                </Text>
              )}
            </Video>
          ) : (
            imageSource && (
              <ImageBackground
                key={attempt}
                source={imageSource}
                style={[StyleSheet.absoluteFill, styles.center]}
                resizeMode="cover"
                // onLoad (success only), NOT onLoadEnd — onLoadEnd also fires
                // after an error, which would mark a dead URL as loaded.
                onLoad={onMediaLoaded}
                onError={onMediaError}
              >
                {media.type === "VIDEO" && (
                  <View style={styles.center}>
                    <Ionicons
                      name="pause"
                      size={40}
                      color="#FFFFFF"
                      style={{
                        shadowRadius: 3,
                        shadowOpacity: 0.35,
                        shadowColor: "#000",
                        shadowOffset: { width: 2, height: 2 },
                      }}
                    />
                    <Text
                      style={[
                        text.label,
                        {
                          color: "#FFFFFF",
                          textShadowColor: "rgba(0,0,0,0.5)",
                          textShadowOffset: { width: 2, height: 2 },
                          textShadowRadius: 2,
                        },
                      ]}
                    >
                      Hold to play
                    </Text>
                  </View>
                )}
              </ImageBackground>
            )
          )}
        </Animated.View>

        {/* Foreground children: fade 200ms AFTER media signals ready (cached or not) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: childOpacity }]}
          pointerEvents="box-none"
        >
          {children}
        </Animated.View>
      </TouchableOpacity>

      {!disableFullscreenPreview && fullscreenPreview && (
        <FullscreenMediaGallery
          media={[fullscreenPreview]}
          initialIndex={0}
          onClose={() => setFullscreenPreview(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center" },
});
