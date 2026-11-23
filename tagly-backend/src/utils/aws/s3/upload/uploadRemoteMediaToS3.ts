/**
 * Download a remote media URL and upload it to S3, returning the stored key,
 * its content type, byte size, and — for images only — pixel dimensions.
 *
 * Sharp-only (v2): there is NO ffmpeg/ffprobe involvement. The bytes fetched
 * from the remote URL are stored verbatim — videos are never transcoded,
 * re-encoded, clipped, or probed, and images are never re-encoded or rotated.
 *
 * Storing Instagram's originals (no size/length/resolution cap) is a deliberate
 * decision: the source is always a bounded, already-compressed live story, and we
 * keep its full quality. Do NOT re-introduce a transcode or byte cap here — any
 * storage-vs-quality tuning belongs in the future media-upload redesign.
 *
 * Behaviour by `expectKind`:
 *  - IMAGE: download to a temp file, read width/height with sharp, then upload
 *    the exact bytes. Returns `width`/`height`.
 *  - VIDEO: stream the bytes straight to S3 as-is (no probe, no transcode).
 *    Returns `width`/`height` as `undefined` — the controller derives a
 *    video's dimensions from its thumbnail (an IMAGE) separately.
 *
 * The content type is normalized from the response (falling back to the HEAD
 * response) and the final S3 key is produced by the caller-supplied `makeKey`,
 * which receives the resolved file extension. All failures throw via
 * `createCustomError` with domain codes (>= 1000).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Readable, Transform, PassThrough } from "node:stream";
import { pipeline as pipelineCb } from "node:stream";
import sharp from "sharp";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { s3Client } from "../../../clients/aws/s3.js";
import { envVariables } from "../../../../environment/envVariables.js";
import { createCustomError } from "../../../core/errors/createCustomError.js";
import { cdnUrlFromKey } from "../helpers/cdnUrlFromKey.js";

const pipeline = promisify(pipelineCb);

type MediaKind = "IMAGE" | "VIDEO";

class ByteCounter extends Transform {
  bytes = 0;
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: Function) {
    this.bytes += chunk.length;
    cb(null, chunk);
  }
}

const normalizeCT = (raw?: string | null) => {
  const base = (raw ?? "").split(";")[0].trim().toLowerCase();
  if (!base) return undefined;
  if (base === "application/mp4") return "video/mp4";
  if (base === "image/jpg") return "image/jpeg";
  return base;
};

async function s3MultipartFromWebStream(
  key: string,
  contentType: string,
  body: ReadableStream<Uint8Array>,
  expectedContentLength?: number
) {
  const source = Readable.fromWeb(body as any);
  const counter = new ByteCounter();
  const pass = new PassThrough();
  source.pipe(counter).pipe(pass);

  const uploader = new Upload({
    client: s3Client as S3Client,
    params: {
      Bucket: envVariables.S3_BUCKET,
      Key: key,
      Body: pass,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
    queueSize: 3,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });
  await uploader.done();

  if (counter.bytes > 0) return counter.bytes;

  const head = await s3Client.send(
    new HeadObjectCommand({ Bucket: envVariables.S3_BUCKET, Key: key })
  );
  return Number(head.ContentLength ?? expectedContentLength ?? 0);
}

async function s3PutFile(key: string, file: string, contentType: string) {
  const stat = await fs.promises.stat(file);

  const uploader = new Upload({
    client: s3Client as S3Client,
    params: {
      Bucket: envVariables.S3_BUCKET,
      Key: key,
      Body: fs.createReadStream(file),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
    queueSize: 3,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });
  await uploader.done();

  return stat.size;
}

async function downloadToTemp(url: string) {
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok || !resp.body) {
    throw createCustomError(
      9101,
      `Download failed: ${resp.status} ${resp.statusText}`,
      400
    );
  }
  const ct = normalizeCT(resp.headers.get("content-type"));
  if (!ct)
    throw createCustomError(9102, "Missing Content-Type from remote URL", 415);

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tagly-"));
  const file = path.join(dir, "in.bin");
  const ws = fs.createWriteStream(file);
  await pipeline(Readable.fromWeb(resp.body as any), ws);

  const lenHeader = resp.headers.get("content-length");
  const contentLength = lenHeader ? Number(lenHeader) : undefined;

  return { file, dir, ct, contentLength };
}

/**
 * IMAGE: download to temp, measure dimensions via sharp, upload exact bytes
 *        (returns width/height).
 * VIDEO: stream the bytes to S3 as-is — no probe, no transcode
 *        (width/height left undefined; the controller derives them from the
 *        video's thumbnail, which is itself an IMAGE).
 */
export async function uploadRemoteMediaToS3(opts: {
  url: string;
  expectKind: MediaKind;
  makeKey: (ext: string) => string;
}): Promise<{
  key: string;
  cdnUrl: string;
  contentType: string;
  extension: string;
  sizeBytes: number;
  width?: number; // set only for IMAGE (sharp-measured)
  height?: number; // set only for IMAGE (sharp-measured)
}> {
  // HEAD (best-effort) — used as a content-type fallback for the streaming path.
  const head = await fetch(opts.url, {
    method: "HEAD",
    redirect: "follow",
  }).catch(() => undefined);
  const headCT = normalizeCT(head?.headers.get("content-type"));

  if (opts.expectKind === "IMAGE") {
    // Download to temp, read dims via sharp, upload exact file.
    const { file, dir, ct } = await downloadToTemp(opts.url);
    try {
      if (!ct.startsWith("image/")) {
        throw createCustomError(9103, `Expected image/*, got ${ct}`, 415);
      }
      const meta = await sharp(file).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        throw createCustomError(9301, "Failed to read image dimensions", 415);
      }
      const ext =
        ct === "image/jpeg"
          ? "jpg"
          : ct === "image/png"
            ? "png"
            : ct === "image/webp"
              ? "webp"
              : "jpg";

      const key = opts.makeKey(ext);
      const sizeBytes = await s3PutFile(key, file, ct);
      return {
        key,
        cdnUrl: cdnUrlFromKey(key),
        contentType: ct,
        extension: ext,
        sizeBytes,
        width,
        height,
      };
    } finally {
      try {
        await fs.promises.rm(dir, { recursive: true, force: true });
      } catch {}
    }
  }

  // VIDEO: stream the bytes straight to S3 as-is. No probe, no transcode.
  const resp = await fetch(opts.url, { redirect: "follow" });
  if (!resp.ok || !resp.body) {
    throw createCustomError(
      9101,
      `Download failed: ${resp.status} ${resp.statusText}`,
      400
    );
  }
  const ct = normalizeCT(resp.headers.get("content-type")) ?? headCT;
  if (!ct || !ct.startsWith("video/")) {
    throw createCustomError(
      9104,
      `Expected video/*, got ${ct ?? "unknown"}`,
      415
    );
  }

  const ext = ct === "video/mp4" ? "mp4" : ct.split("/")[1] || "mp4";
  const key = opts.makeKey(ext);
  const sizeBytes = await s3MultipartFromWebStream(key, ct, resp.body);
  return {
    key,
    cdnUrl: cdnUrlFromKey(key),
    contentType: ct,
    extension: ext,
    sizeBytes,
  };
}
