import {
  SUPPORTED_IMG_MIMES,
  SUPPORTED_VIDEO_MIMES,
} from "@tagly/models/shared";
import { createCustomError } from "../core/errors/createCustomError.js";

export function getMediaTypeFromMime(mime: string): "IMAGE" | "VIDEO" {
  if (SUPPORTED_IMG_MIMES.includes(mime as any)) return "IMAGE";
  if (SUPPORTED_VIDEO_MIMES.includes(mime as any)) return "VIDEO";

  const top = mime.split("/")[0];
  if (top === "image") return "IMAGE";
  if (top === "video") return "VIDEO";

  throw createCustomError(
    5205,
    `Unsupported or unrecognized MIME type: ${mime}`,
    400
  );
}
