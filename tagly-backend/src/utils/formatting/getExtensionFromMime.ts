import mime from "mime-types";
import { createCustomError } from "../core/errors/createCustomError.js";

export function getExtensionFromMime(mimeName: string) {
  const extension = mime.extension(mimeName);

  if (extension === false) {
    throw createCustomError(
      4040,
      "Unsupported Mime - cannot create extension",
      400
    );
  }

  return extension;
}
