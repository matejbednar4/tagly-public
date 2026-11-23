import { Prisma } from "../../../../generated/prisma/client.js";

export const mediaPreviewSelect = {
  aspectRatio: true,
  type: true,
  uid: true,
  key: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;
