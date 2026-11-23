import { PresignedUpload } from "@tagly/models/shared";

type CustomAlertFn = (title: string, message: string) => void;

type UploadOpts = {
  shouldAlert?: boolean; // default true
  alertTitle?: string; // default "Upload failed"
  customAlert?: CustomAlertFn;
};

let lastAlertKey = "";
let lastAlertAt = 0;

function maybeAlert(
  customAlert: CustomAlertFn | undefined,
  message: string,
  title = "Upload failed",
) {
  if (!customAlert) return;
  const now = Date.now();
  const key = `${title}::${message}`;
  // de-dupe same alert within 2s (helps with parallel uploads)
  if (key === lastAlertKey && now - lastAlertAt < 2000) return;
  lastAlertKey = key;
  lastAlertAt = now;
  customAlert(title, message);
}

function parseS3XmlError(
  xml: string,
  fallbackStatus?: number,
  maxBytes?: number
) {
  const code = xml.match(/<Code>(.*?)<\/Code>/)?.[1];
  const msg = xml.match(/<Message>(.*?)<\/Message>/)?.[1];

  if (code === "EntityTooLarge") {
    const xmlMax = xml.match(/<MaxSizeAllowed>(\d+)<\/MaxSizeAllowed>/)?.[1];
    const max = Number(xmlMax ?? maxBytes ?? 0);

    if (max > 0) {
      const mb = (max / (1024 * 1024)).toFixed(1);
      return `This file is too large. The maximum allowed size is ${mb} MB.`;
    }

    return "This file is too large.";
  }

  if (msg) return msg;

  return `S3 upload failed${fallbackStatus ? ` (${fallbackStatus})` : ""}.`;
}

/**
 * POSTs one file to a presigned S3 slot. Throws on any failure (network,
 * expired presign, EntityTooLarge, non-2xx).
 *
 * ⚠️ This does NOT alert the user on its own: `maybeAlert` fires only through
 * a caller-injected `opts.customAlert`, and **no call site in the repo injects
 * one** — the built-in messages are also English-only, so user feedback is
 * localized at the call site instead. Every caller MUST catch the throw and
 * show a real alert (the shared `businessPageForm` namespace's
 * `uploadIncompleteTitle/Body` is the standard copy) — a bare
 * `catch { return; }` here is a silent dead-end (E045).
 */
export async function uploadPresigned(
  slot: PresignedUpload,
  file: { uri: string; mime: string },
  opts: UploadOpts = {},
) {
  const {
    shouldAlert = true,
    alertTitle = "Upload failed",
    customAlert,
  } = opts ?? {};

  const fd = new FormData();
  Object.entries(slot.fields).forEach(([k, v]) => fd.append(k, String(v)));

  const fileName = slot.key.split("/").pop()!;

  // Native: use the RN-style object with uri.
  fd.append("file", {
    uri: file.uri.startsWith("file://") ? file.uri : `file://${file.uri}`,
    type: file.mime,
    name: fileName,
  } as any);

  let res: Response | undefined;
  try {
    res = await fetch(slot.url, { method: "POST", body: fd });
  } catch (netErr: any) {
    const message =
      typeof netErr?.message === "string"
        ? netErr.message
        : "Network error while uploading. Please check your connection and try again.";
    if (shouldAlert) maybeAlert(customAlert, message, alertTitle);
    throw new Error(message);
  }

  if (!res.ok) {
    let raw = "";
    try {
      raw = await res.text();
    } catch {}
    const message = raw?.includes("<Error>")
      ? parseS3XmlError(raw, res.status, (slot as any).maxBytes)
      : `Upload failed (${res.status}).`;

    if (shouldAlert) maybeAlert(customAlert, message, alertTitle);
    throw new Error(message);
  }
}
