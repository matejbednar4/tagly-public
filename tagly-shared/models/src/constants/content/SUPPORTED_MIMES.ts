import { z } from "zod";

export const SUPPORTED_IMG_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const SUPPORTED_VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
] as const;

export const SUPPORTED_MIMES = [
  ...SUPPORTED_IMG_MIMES,
  ...SUPPORTED_VIDEO_MIMES,
] as const;

export type SupportedImgMime = (typeof SUPPORTED_IMG_MIMES)[number];
export type SupportedVideoMime = (typeof SUPPORTED_VIDEO_MIMES)[number];
export type SupportedMime = (typeof SUPPORTED_MIMES)[number];


export const normalizeImgMime = (
  input: unknown
): SupportedImgMime | undefined => {
  if (typeof input !== "string") return undefined;
  const lower = input.toLowerCase().trim();
  if (lower === "image/jpg" || lower.startsWith("image/jpeg"))
    return "image/jpeg";
  if (lower === "image/pjpeg") return "image/jpeg";
  if (lower === "image/x-png" || lower.startsWith("image/png"))
    return "image/png";
  if (lower.startsWith("image/webp")) return "image/webp";
  if (lower.startsWith("image/heic")) return "image/heic";
  if (lower.startsWith("image/heif")) return "image/heif";
  return undefined;
};

// --- Wrapper schema that pre-normalizes ---
export const SupportedImgMimeSchema = z.preprocess(
  (val) => normalizeImgMime(val),
  z.enum(SUPPORTED_IMG_MIMES)
);
