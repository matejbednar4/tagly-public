import type { RequestHandler } from "express";
import type {
  ResolveQrStickerParams,
  ResolveQrStickerResponse,
} from "@tagly/models/v2/crossApp";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import { businessVisibleWhere } from "../../../utils/businesses/businessAccessibility.js";
import prisma from "../../../prisma/prisma.js";

/**
 * v2 — `GET /v2/public/stickers/:id`. Resolves a printed QR sticker number to
 * the business it hangs in, so the join page can personalize its landing hero
 * ("Earn at Café XYZ") when a table sticker is scanned
 * (`https://join.tagly.cz/?utm_source=table-sticker&id=000123`).
 *
 * `id` is the OPAQUE printed string, matched exactly against the unique
 * `stickerId` column — `QrStickerIdSchema` only shape-checks it (URL-safe,
 * 1-64 chars), it never normalizes.
 *
 * Unauthenticated + IP-rate-limited. Returns only public, non-sensitive
 * fields. 404s — marked `expected` so random public probes don't spam the
 * error tracker — when the sticker was never assigned (no row; unassign
 * hard-deletes) or the business is not customer-visible
 * (`businessVisibleWhere` — a BANNED/DELETED business must not leak its name
 * through a sticker probe). The join page treats 404 as "render the generic
 * landing".
 *
 * `referralCode` — the owning advertiser's ACTIVE referral code, so the
 * sticker-acquired signup is referred by the business owner. Null when the
 * business is platform-subsidized/unowned or the code isn't ACTIVE.
 */
export const resolveQrSticker: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams as ResolveQrStickerParams;

  const sticker = await prisma.qrSticker.findUnique({
    where: { stickerId: id },
    select: {
      local: {
        select: {
          uid: true,
          name: true,
          status: true,
          advertiser: {
            select: {
              accountReferral: { select: { code: true, status: true } },
            },
          },
        },
      },
    },
  });

  const local =
    sticker && sticker.local.status === businessVisibleWhere.status
      ? sticker.local
      : null;
  if (!local) {
    throw createCustomError(5311, "Sticker not assigned", {
      status: 404,
      expected: true,
    });
  }

  const referral = local.advertiser?.accountReferral ?? null;
  const referralCode =
    referral && referral.status === "ACTIVE" ? referral.code : null;

  res.status(200).json({
    message: "Sticker resolved",
    business: { uid: local.uid, name: local.name, referralCode },
  } satisfies ResolveQrStickerResponse);
});
