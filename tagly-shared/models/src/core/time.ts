import { z } from "zod";

export const ISODateSchema = z
  .union([z.string(), z.number(), z.date()])
  .transform((val) => {
    if (val instanceof Date) return val.toISOString();
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      throw new Error("Invalid date");
    }
    return d.toISOString();
  });

export type ISODate = z.infer<typeof ISODateSchema>; // always string
