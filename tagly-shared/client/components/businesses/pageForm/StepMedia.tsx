import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { CustomButton } from "../../primitives/CustomButton";
import { useTheme } from "../../../theme/ThemeProvider";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { withQualityCdnUrlFromKey } from "../../../utils/media/withQualityCdnUrlFromKey";
import { BUSINESS_MAX_PHOTOS, type MediaPreview } from "@tagly/models/v2/crossApp";
import {
  pickBanner,
  pickPhotos,
  type PickedMedia,
} from "../../../services/media/pickMedia";
import { StepShell, FieldLabel } from "./StepShell";

/** Height of a photo thumbnail in the strip; width follows its aspect ratio. */
const PHOTO_H = 104;

/**
 * A banner/photo in the form: either an existing uploaded `Media` (the edit
 * screen seeding the business's current pictures — rendered from the CDN,
 * never re-uploaded) or a fresh local pick (rendered from its cache URI and
 * uploaded on save). The create wizard only ever holds `local` entries.
 */
export type FormMedia =
  | { kind: "remote"; media: MediaPreview }
  | { kind: "local"; media: PickedMedia };

const formMediaUri = (m: FormMedia): string =>
  m.kind === "remote"
    ? withQualityCdnUrlFromKey(m.media.key, { w: 600 })
    : m.media.uri;

const formMediaAspect = (m: FormMedia): number =>
  m.kind === "remote"
    ? m.media.aspectRatio
    : m.media.height
      ? m.media.width / m.media.height
      : 1;

/**
 * Media step/form — banner (required, cropped 16:9) + gallery photos (up to
 * BUSINESS_MAX_PHOTOS, any aspect ratio). The add tiles read like inputs:
 * white surface + card shadow (floating), not dashed outlines. Photos preview
 * at their true aspect ratio in a horizontal strip, mirroring the customer
 * detail gallery. Host-agnostic: the create wizard drives it with local picks
 * only; the media edit screens seed `remote` entries and pass
 * `ctaLabel`/`loading` for their save flow.
 */
export function StepMedia({
  header,
  businessName,
  banner,
  photos,
  setBanner,
  setPhotos,
  onBack,
  onContinue,
  topInset,
  ctaLabel,
  loading = false,
  title,
  subtitle,
}: {
  header?: ReactNode;
  /** Forwarded to StepShell — see its docblock. */
  topInset?: boolean;
  /** The name from step 1, so copy can say the business by name once known. */
  businessName: string;
  banner: FormMedia | null;
  photos: FormMedia[];
  setBanner: (media: FormMedia | null) => void;
  setPhotos: (photos: FormMedia[]) => void;
  onBack?: () => void;
  onContinue: () => void;
  /** CTA label override (edit screens pass "Save"); defaults to Continue. */
  ctaLabel?: string;
  /** CTA spinner while an edit-screen save is in flight. */
  loading?: boolean;
  /** Title/subtitle overrides for the edit screens; default to create copy. */
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow, layout } = theme;
  // Personalize with the entered name; fall back to "your business" if empty.
  const business = businessName.trim() || t("yourBusiness");

  const chooseBanner = async () => {
    const picked = await pickBanner();
    if (picked) setBanner({ kind: "local", media: picked });
  };

  const addPhotos = async () => {
    const remaining = BUSINESS_MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const picked = await pickPhotos(remaining);
    if (picked.length) {
      setPhotos(
        [
          ...photos,
          ...picked.map((media): FormMedia => ({ kind: "local", media })),
        ].slice(0, BUSINESS_MAX_PHOTOS),
      );
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // Floating "input-like" empty tiles: white surface, rounded, elevated. The
  // big banner uses `card`; the small photo tile uses `chip` (right rung on the
  // elevation ladder — and its tiny blur won't clip inside the photo strip).
  const addTileBase = {
    backgroundColor: color.surface,
    borderRadius: radius.structure,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const canAddMore = photos.length < BUSINESS_MAX_PHOTOS;

  return (
    <StepShell
      header={header}
      topInset={topInset}
      title={title ?? t("mediaTitle")}
      subtitle={subtitle ?? t("mediaSubtitle", { business })}
      onBack={onBack}
      cta={
        <>
          <CustomButton
            type="primary"
            label={ctaLabel ?? t("continue")}
            onPress={onContinue}
            disabled={!banner}
            loading={loading}
          />
          {!banner ? (
            // Same treatment as CustomTextInput's error line (see StepBasics).
            <Text
              style={[
                text.caption,
                { color: color.on.dangerText, textAlign: "center" },
              ]}
            >
              {t("missingHint", { fields: t("bannerLabel") })}
            </Text>
          ) : null}
        </>
      }
    >
      {/* Banner */}
      <View style={{ gap: spacing.sm }}>
        <FieldLabel required>{t("bannerLabel")}</FieldLabel>
        <Pressable
          onPress={() => void chooseBanner()}
          accessibilityRole="button"
          style={({
            pressed,
            hovered,
          }: {
            pressed: boolean;
            hovered?: boolean;
          }) => [
            {
              width: "100%",
              aspectRatio: 16 / 9,
              borderRadius: radius.structure,
            },
            banner
              ? { overflow: "hidden" }
              : { ...addTileBase, boxShadow: shadow.card },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          {banner ? (
            <>
              <Image
                source={{ uri: formMediaUri(banner) }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              {/* "Change" affordance so a filled banner still reads as editable. */}
              <View
                style={{
                  position: "absolute",
                  bottom: spacing.sm,
                  right: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.pill,
                  backgroundColor: color.ink,
                }}
              >
                <Ionicons
                  name="camera-outline"
                  size={13}
                  color={color.on.ink}
                />
                <Text style={[text.micro, { color: color.on.ink }]}>
                  {t("changeBanner")}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <Ionicons
                name="image-outline"
                size={28}
                color={color.text.tertiary}
              />
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("addBanner")}
              </Text>
            </View>
          )}
        </Pressable>
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {t("bannerHint")}
        </Text>
      </View>

      {/* Photos — natural-AR strip + a floating add tile. */}
      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t("photosLabel")}</FieldLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Full-bleed: cancel StepShell's horizontal inset so the strip scrolls
          // edge-to-edge, then re-add it as content padding so the first tile
          // still lines up with the label and the last can scroll to the edge.
          // Vertically the same trick gives the add tile's shadow.card (outer
          // layer 0 4px 14px → ~18px past the box) room inside the clipping
          // ScrollView while the negative margin keeps the visual rhythm at
          // the original xs.
          style={{
            marginHorizontal: -layout.screenPadding,
            marginVertical: spacing.xs - spacing.lg,
          }}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingVertical: spacing.lg,
            paddingHorizontal: layout.screenPadding,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {photos.map((photo, i) => {
            const uri = formMediaUri(photo);
            return (
              <View key={uri + i}>
                <Image
                  source={{ uri }}
                  style={{
                    height: PHOTO_H,
                    aspectRatio: formMediaAspect(photo),
                    borderRadius: radius.structure,
                  }}
                  resizeMode="cover"
                />
                {/* Badge sits inside the image corner (not overflowing), so
                    nothing to clip in the strip. */}
                <Pressable
                  onPress={() => removePhoto(i)}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={{
                    position: "absolute",
                    top: spacing.xs,
                    right: spacing.xs,
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    backgroundColor: color.ink,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={13} color={color.on.ink} />
                </Pressable>
              </View>
            );
          })}

          {canAddMore ? (
            <Pressable
              onPress={() => void addPhotos()}
              accessibilityRole="button"
              accessibilityLabel={t("addPhotos")}
              style={({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => [
                { height: PHOTO_H, width: PHOTO_H },
                addTileBase,
                { boxShadow: shadow.card },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Ionicons name="add" size={26} color={color.text.tertiary} />
            </Pressable>
          ) : null}
        </ScrollView>
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {t("photosHint", { max: BUSINESS_MAX_PHOTOS })}
        </Text>
      </View>
    </StepShell>
  );
}
