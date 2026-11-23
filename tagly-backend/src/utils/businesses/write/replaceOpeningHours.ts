import type { Prisma } from "../../../generated/prisma/client.js";
import type { OpeningHoursPeriod } from "@tagly/models/v2/crossApp";

/**
 * Replace a business's opening hours wholesale inside an existing transaction:
 * wipe the stored periods and rewrite the given set (empty = clear all).
 * Replace-all is the only update semantic — periods have no identity worth
 * diffing. Shared by update and future admin edit.
 */
export async function replaceOpeningHours(
  tx: Prisma.TransactionClient,
  {
    localId,
    periods,
  }: {
    localId: number;
    periods: OpeningHoursPeriod[];
  },
): Promise<void> {
  await tx.openingHoursPeriod.deleteMany({ where: { localId } });
  if (periods.length) {
    await tx.openingHoursPeriod.createMany({
      data: periods.map((p) => ({
        localId,
        dayOfWeek: p.dayOfWeek,
        openMinute: p.openMinute,
        closeMinute: p.closeMinute,
      })),
    });
  }
}
