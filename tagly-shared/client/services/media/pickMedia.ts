import ImageCropPicker, {
  type ImageOrVideo,
} from "react-native-image-crop-picker";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { requestPhotoLibraryPermission } from "../permissions/requestPhotoLibraryPermission";
import { customAlert } from "../../components/feedback/alert";
// Import the local i18n module directly (not the "@tagly/client" barrel) to
// avoid an import cycle, since this file is itself part of @tagly/client.
import { i18n } from "../../i18n";

/**
 * A picked, already-compressed local image ready for a presigned upload.
 * `width`/`height` are the post-crop/resize pixel dimensions — used to preview
 * photo thumbnails at their true aspect ratio (0 if the picker didn't report them).
 */
export type PickedMedia = {
  uri: string;
  mime: string;
  width: number;
  height: number;
};

/**
 * Output boxes for business-page media. Banner is CROPPED to an exact
 * 16:9 (the server re-enforces the ratio at confirm); photos are only resized
 * to fit the box, never cropped.
 */
export const MEDIA_DIMENSIONS = {
  banner: { width: 1920, height: 1080 }, // 16:9, cropped exactly
  photo: { width: 1920, height: 1920 }, // max box — any aspect ratio, longest side ≤ 1920
} as const;

const COMPRESSION_QUALITY = 0.85;
// JPEG on BOTH platforms. Never webp: every business image passes AWS
// Rekognition moderation at confirm, and Rekognition accepts only JPEG/PNG —
// a webp upload 500s with Rekognition's InvalidImageFormatException (found
// on-device 2026-08-12; the old Android webp config had the same latent bug).
const FORMAT = "jpeg";

/**
 * PLATFORM SPLIT (Google Play photo/video permissions policy, rejection
 * 2026-08-11): on Android, gallery PICKING must go through the system Photo
 * Picker — `expo-image-picker`'s launchImageLibraryAsync, which needs NO
 * media permissions (READ_MEDIA_IMAGES/VIDEO are stripped via
 * `blockedPermissions` in both app configs; do not re-add them). The banner's
 * interactive 16:9 crop stays on `ImageCropPicker.openCropper`, which is
 * permission-free because it operates on the picker's cache-local file copy.
 * Photo resize+compress moves to `expo-image-manipulator` for the same reason.
 *
 * iOS keeps the original single-step ImageCropPicker flow untouched (no such
 * policy; NSPhotoLibraryUsageDescription is declared in every app config).
 */

const toPicked = (img: ImageOrVideo): PickedMedia => ({
  uri: img.path.startsWith("file://") ? img.path : `file://${img.path}`,
  mime: img.mime,
  width: img.width ?? 0,
  height: img.height ?? 0,
});

/** Cancel is silent; real picker failures get one generic alert. */
function handlePickerError(err: unknown): null {
  const code = (err as { code?: string })?.code;
  const message = String((err as Error)?.message ?? "");
  if (code === "E_PICKER_CANCELLED" || /cancel/i.test(message)) return null;
  customAlert(
    i18n.t("pickerErrorTitle", { ns: "pickMedia" }),
    i18n.t("pickerErrorBody", { ns: "pickMedia" }),
  );
  return null;
}

/**
 * Android: system Photo Picker → local file:// asset(s). Returns [] on cancel.
 * No permission request — the Photo Picker never needs one (and on pre-13
 * devices expo-image-picker falls back to the permissionless system
 * document/gallery intent).
 */
async function launchSystemPicker(
  maxFiles: number,
): Promise<ImagePicker.ImagePickerAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: maxFiles > 1,
    selectionLimit: maxFiles,
    quality: 1, // full quality here; compression happens in the resize step
  });
  if (result.canceled) return [];
  return result.assets ?? [];
}

/**
 * Pick + crop the business banner. The cropper is locked to 16:9
 * (`freeStyleCropEnabled: false` + the exact 1280×720 box). Null on cancel /
 * denied permission / failure.
 */
export async function pickBanner(): Promise<PickedMedia | null> {
  if (Platform.OS === "android") {
    try {
      const [asset] = await launchSystemPicker(1);
      if (!asset) return null;
      const img = (await ImageCropPicker.openCropper({
        path: asset.uri,
        mediaType: "photo",
        width: MEDIA_DIMENSIONS.banner.width,
        height: MEDIA_DIMENSIONS.banner.height,
        compressImageQuality: COMPRESSION_QUALITY,
        compressImageFormat: FORMAT,
        freeStyleCropEnabled: false,
        cropperToolbarTitle: i18n.t("cropBannerTitle", { ns: "pickMedia" }),
      } as Parameters<typeof ImageCropPicker.openCropper>[0])) as ImageOrVideo;
      return toPicked(img);
    } catch (err) {
      return handlePickerError(err);
    }
  }

  const granted = await requestPhotoLibraryPermission(customAlert);
  if (!granted) return null;
  try {
    const img = (await ImageCropPicker.openPicker({
      mediaType: "photo",
      cropping: true,
      width: MEDIA_DIMENSIONS.banner.width,
      height: MEDIA_DIMENSIONS.banner.height,
      compressImageQuality: COMPRESSION_QUALITY,
      compressImageFormat: FORMAT,
      freeStyleCropEnabled: false,
      cropperToolbarTitle: i18n.t("cropBannerTitle", { ns: "pickMedia" }),
    } as Parameters<typeof ImageCropPicker.openPicker>[0])) as ImageOrVideo;
    return toPicked(img);
  } catch (err) {
    return handlePickerError(err);
  }
}

/**
 * Android: fit the picked asset inside the photo box (longest side ≤ 1920,
 * never cropped, never upscaled) and re-encode as JPEG — the same output the
 * ImageCropPicker options produce on the iOS path.
 */
async function resizeForUpload(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PickedMedia> {
  const { width = 0, height = 0 } = asset;
  const longest = Math.max(width, height);
  const box = MEDIA_DIMENSIONS.photo.width;
  const actions =
    longest > box
      ? [width >= height ? { resize: { width: box } } : { resize: { height: box } }]
      : [];
  const out = await manipulateAsync(asset.uri, actions, {
    compress: COMPRESSION_QUALITY,
    format: SaveFormat.JPEG,
  });
  return {
    uri: out.uri,
    mime: "image/jpeg",
    width: out.width ?? 0,
    height: out.height ?? 0,
  };
}

/**
 * Pick up to `maxFiles` gallery photos (resized to fit 1600×1600, not
 * cropped). Empty array on cancel / denied permission / failure.
 */
export async function pickPhotos(maxFiles: number): Promise<PickedMedia[]> {
  if (maxFiles <= 0) return [];

  if (Platform.OS === "android") {
    try {
      const assets = await launchSystemPicker(maxFiles);
      return await Promise.all(assets.slice(0, maxFiles).map(resizeForUpload));
    } catch (err) {
      handlePickerError(err);
      return [];
    }
  }

  const granted = await requestPhotoLibraryPermission(customAlert);
  if (!granted) return [];
  try {
    const result = (await ImageCropPicker.openPicker({
      mediaType: "photo",
      multiple: true,
      maxFiles,
      cropping: false,
      compressImageMaxWidth: MEDIA_DIMENSIONS.photo.width,
      compressImageMaxHeight: MEDIA_DIMENSIONS.photo.height,
      compressImageQuality: COMPRESSION_QUALITY,
      compressImageFormat: FORMAT,
    } as Parameters<typeof ImageCropPicker.openPicker>[0])) as
      | ImageOrVideo
      | ImageOrVideo[];
    const list = Array.isArray(result) ? result : [result];
    return list.slice(0, maxFiles).map(toPicked);
  } catch (err) {
    handlePickerError(err);
    return [];
  }
}
