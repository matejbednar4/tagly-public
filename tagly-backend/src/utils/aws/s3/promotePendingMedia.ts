import type { Prisma } from "../../../generated/prisma/client.js";
import { ImageCopy } from "./validation/validateAndCopyImages.js";

export async function promotePendingMedia(
  tx: Prisma.TransactionClient,
  copies: ImageCopy[]
): Promise<number[]> {
  const results = await Promise.all(
    copies.map(({ finalUid, finalKey, v }) =>
      tx.media.create({
        data: {
          uid: finalUid,
          key: finalKey,
          type: "IMAGE",
          mime: v.actualMime,
          sizeBytes: v.sizeBytes,
          width: v.width,
          height: v.height,
          aspectRatio: v.aspectRatio,
        },
        select: { id: true },
      })
    )
  );
  return results.map((r) => r.id);
}

export async function promoteOnePendingMedia(
  tx: Prisma.TransactionClient,
  copy: ImageCopy
): Promise<number> {
  const [id] = await promotePendingMedia(tx, [copy]);
  return id!;
}
