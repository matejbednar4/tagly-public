import Constants from "expo-constants";

const { CLOUDFORMATION_API_URL, S3_BUCKET, CDN_BASE_URL } = Constants.expoConfig
  ?.extra as any;

const ALLOWED_WIDTHS = [120, 240, 360, 480, 720, 1080, 1440, 1920] as const;

const VIDEO_EXTS = /\.(mp4|mov|m4v|webm|mkv|m3u8)$/i;

function isVideoKey(key: string) {
  return VIDEO_EXTS.test(key);
}

function nearestWidth(w?: number) {
  if (!w) return undefined;
  return ALLOWED_WIDTHS.reduce(
    (p, c) => (Math.abs(c - w) < Math.abs(p - w) ? c : p),
    ALLOWED_WIDTHS[0]
  );
}

function encodeKeyPath(key: string) {
  const full = `${key}`.replace(/^\/+/, ""); // no leading slash
  return full.split("/").map(encodeURIComponent).join("/");
}

export function withQualityCdnUrlFromKey(
  key: string,
  opts: { w?: number; quality?: number } = {}
) {
  if (!key) throw new Error("withQualityCdnUrlFromKey: key is required");

  const width = nearestWidth(opts.w);
  const q = opts.quality ?? 50;
  const encodedKey = encodeKeyPath(key);

  if (isVideoKey(key)) {
    return `${CDN_BASE_URL}/${encodedKey}`;
  }

  const size = width ? `fit-in/${width}x0/` : "";
  const filters = `filters:quality(${q})/`;

  return `${CLOUDFORMATION_API_URL}/${size}${filters}s3:${S3_BUCKET}/${encodedKey}`;
}
