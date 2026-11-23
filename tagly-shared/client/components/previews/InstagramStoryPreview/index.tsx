import { Image, StyleProp, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { InstagramStory } from "@tagly/models/shared";
import { CustomMedia } from "../../media/CustomMedia";
import { useTheme } from "../../../theme/ThemeProvider";
import { withAlpha } from "../../../theme/colorUtils";
import { spacing } from "../../../theme/theme";

/** Stories are always portrait 9:16. */
const STORY_ASPECT_RATIO = 9 / 16;

/**
 * White text sitting directly on the story photo. A soft dark text-shadow keeps
 * it legible over any image without a full scrim (same approach as
 * `BusinessPreview`'s on-photo label). Black is fine for a *text* shadow over a
 * photo — the "no black shadow" rule is about surface elevation.
 */
const ON_PHOTO_TEXT = {
  color: "#FFFFFF",
  textShadowColor: "rgba(0, 0, 0, 0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

/** Total rendered height for a given tile width (stories are 9:16). */
export const instagramStoryPreviewHeight = (width: number) =>
  Math.round(width / STORY_ASPECT_RATIO);

type TFunc = ReturnType<typeof useTranslation<"instagramStoryPreview">>["t"];

/**
 * Compact "time ago" for when the story was posted. Stories live ~24h, so the
 * units stay small (`now` / `5m` / `3h`), mirroring Instagram's own story chrome.
 */
function formatPostedAgo(timestamp: string, t: TFunc): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  return t("daysAgo", { count: Math.floor(hours / 24) });
}

export interface InstagramStoryPreviewProps {
  story: InstagramStory;
  /** The poster's Instagram profile picture; a glyph avatar shows when null. */
  pfpUrl?: string | null;
  /** Tile width in px; height is derived 9:16 (`instagramStoryPreviewHeight`). */
  width: number;
  /** Elevates the tile (card → float) and shows the selected check. */
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * InstagramStoryPreview — a 9:16 tile for a single live Instagram story, framed
 * so it reads unmistakably *as* a story: a top progress segment, the poster's
 * circular avatar, the posted-ago time, and the Instagram glyph, over the story
 * media itself. Video stories autoplay (muted + looping, via CustomMedia's
 * `renderVideo`); image stories show the image. The selected state lifts the tile
 * (card → float), washes it in translucent accent, and stamps an ink check.
 *
 * A story with no `mediaUrl` (Instagram withholds the media for copyright-
 * flagged content — typically a music sticker) renders CustomMedia's quiet
 * "unavailable" placeholder with the reason string, under muted story chrome
 * (the on-photo white would vanish on the surface fill). It stays tappable —
 * hosts alert/explain rather than select.
 *
 * Presentational: the caller owns selection (`selected` + `onPress`) and the
 * profile picture (`pfpUrl`, e.g. the viewer's own `customer.instagram.pfpUrl`),
 * so the same tile works for the share-create picker and any later story-review
 * surface. Width-driven; height comes from `instagramStoryPreviewHeight(width)`.
 */
export function InstagramStoryPreview({
  story,
  pfpUrl,
  width,
  selected,
  onPress,
  style,
}: InstagramStoryPreviewProps) {
  const { t } = useTranslation("instagramStoryPreview");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;

  const postedAgo = formatPostedAgo(story.timestamp, t);
  const mediaAvailable = !!story.mediaUrl;

  return (
    // The tap is owned by the single CustomMedia touchable below (it always
    // renders a TouchableOpacity); wrapping this in a Pressable too made two
    // responders fight and swallowed the press, so the container stays a plain
    // View — same pattern as BusinessPreview.
    <View style={[{ width }, style]}>
      <View
        style={{
          width,
          height: instagramStoryPreviewHeight(width),
          borderRadius: radius.structure,
          overflow: "hidden",
          boxShadow: selected ? shadow.float : shadow.card,
        }}
      >
        {/* Render the real media so videos play: `renderVideo` + a VIDEO media
            type makes CustomMedia mount an autoplaying, muted, looping <Video>;
            image stories render the image. (No `thumbnail` poster: that prop only
            applies to key-based `MediaPreview`s, while stories carry plain URLs,
            and `renderVideo` plays the video directly with no poster needed.)
            A story whose media Instagram withholds (no `mediaUrl` — copyright-
            flagged, typically a music sticker) gets CustomMedia's quiet
            placeholder with the reason string instead. */}
        <CustomMedia
          media={{
            url: story.mediaUrl ?? "",
            type: story.mediaType,
            aspectRatio: STORY_ASPECT_RATIO,
          }}
          unavailableMessage={t("mediaWithheld")}
          onPress={onPress}
          style={{ flex: 1 }}
          backgroundColor={color.surface}
          renderVideo
        >
          {/* Selected: a translucent accent (blue) wash tints the whole tile.
              Accent is the design system's "selected" color; it sits under the
              chrome + check (first child) so those stay crisp on top. */}
          {selected && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: withAlpha(color.ink, 0.4),
              }}
            />
          )}

          {/* Instagram-story chrome, pinned to the top. On the media it's white
              with a text-shadow; on the unavailable placeholder (surface fill)
              it switches to muted ink/tertiary — white-on-white would vanish. */}
          <View
            style={{
              position: "absolute",
              top: spacing.sm,
              left: spacing.sm,
              right: spacing.sm,
              gap: spacing.sm,
            }}
          >
            {/* Single story-progress segment — the signature story signal. */}
            <View
              style={{
                height: 2.5,
                borderRadius: radius.pill,
                backgroundColor: mediaAvailable
                  ? "rgba(255, 255, 255, 0.7)"
                  : withAlpha(color.ink, 0.15),
              }}
            />

            {/* Avatar · posted-ago · Instagram glyph. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              {/* Avatar on a white halo (a ring via surface + shadow, not a
                  border). */}
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: color.surface,
                  boxShadow: shadow.chip,
                }}
              >
                {pfpUrl ? (
                  <Image
                    source={{ uri: pfpUrl }}
                    style={{ width: 22, height: 22, borderRadius: radius.pill }}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={14}
                    color={color.text.tertiary}
                  />
                )}
              </View>

              <Text
                style={[
                  text.micro,
                  mediaAvailable
                    ? ON_PHOTO_TEXT
                    : { color: color.text.tertiary },
                ]}
                numberOfLines={1}
              >
                {postedAgo}
              </Text>

              <View style={{ flex: 1 }} />

              <Ionicons
                name="logo-instagram"
                size={16}
                style={mediaAvailable ? ON_PHOTO_TEXT : undefined}
                color={mediaAvailable ? undefined : color.text.tertiary}
              />
            </View>
          </View>

          {/* No "play" badge: video stories autoplay (muted + looping), so the
              motion itself signals it's a video. */}

          {/* Selected check, bottom-right (ink fill + on-ink tick). */}
          {selected && (
            <View
              style={{
                position: "absolute",
                height: "100%",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  backgroundColor: color.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="checkmark" size={24} color={color.on.brand} />
              </View>
            </View>
          )}
        </CustomMedia>
      </View>
    </View>
  );
}
