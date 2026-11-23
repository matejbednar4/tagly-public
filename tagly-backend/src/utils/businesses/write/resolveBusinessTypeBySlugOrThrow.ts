import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";

/**
 * Resolve a business-type catalog slug (the v2 wire form) to its DB id.
 * Shared by every business write path (create, update, future admin) so the
 * slug → id rule and its error code live in one place. 4008 on an unknown slug.
 */
export async function resolveBusinessTypeBySlugOrThrow(
  typeSlug: string,
): Promise<{ id: number }> {
  const validType = await prisma.advertiserType.findUnique({
    where: { slug: typeSlug },
    select: { id: true },
  });
  if (!validType) {
    throw createCustomError(4008, "Unknown business type", 400);
  }
  return validType;
}
