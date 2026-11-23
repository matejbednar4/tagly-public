import { z } from "zod";

/**
 * QR sticker id — an OPAQUE string, matched exactly as printed.
 *
 * The id is whatever is printed on the physical sticker: the current batch
 * uses zero-padded numbers ("000001"–"001050"), future batches may use random
 * strings ("yf5h8ayui21r"). The platform performs NO normalization — no
 * padding, no case folding, no numeric interpretation. "1" and "000001" are
 * two different ids; admins enter the id exactly as printed, and every
 * surface (the unique `qr_stickers.sticker_id` column, URLs, OneLink
 * attribution params, analytics properties, UI) carries the same literal
 * string.
 *
 * `QrStickerIdSchema` only bounds shape: trimmed, 1–64 chars, URL-safe
 * charset (letters, digits, `_`, `-`) so ids ride query strings and path
 * params unescaped.
 *
 * (tagly-join is a standalone project that can't import this package — its
 * copy of the rule lives in `tagly-join/src/lib/resolveSticker.ts`; keep the
 * two in sync.)
 */
export const QrStickerIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/);
export type QrStickerId = z.infer<typeof QrStickerIdSchema>;
