import { z } from "zod";

// Currencies the platform currently supports end-to-end. Adding a new currency
// here is a one-line change once the rest of the multi-currency machinery
// (per-currency balance columns, reward tables, geocoding-driven currency
// derivation) lands.
export const SUPPORTED_CURRENCIES = ["usd"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export const SupportedCurrencySchema = z.enum(SUPPORTED_CURRENCIES);

// Legacy permissive schema — kept for backwards wire-format tolerance with
// older clients that may still send a `currency` string. Prefer
// `SupportedCurrencySchema` for new validation.
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{3}$/, "currency must be a 3-letter ISO code");

export const CentsSchema = z
  .union([z.bigint(), z.string(), z.number()])
  .transform((v) => {
    const bi =
      typeof v === "bigint" ? v : typeof v === "number" ? BigInt(v) : BigInt(v);
    const n = Number(bi);
    if (!Number.isSafeInteger(n)) {
      throw new Error("cents out of safe integer range");
    }
    return n;
  });

export type Cents = z.infer<typeof CentsSchema>;
