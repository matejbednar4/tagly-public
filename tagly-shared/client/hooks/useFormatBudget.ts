import { useCallback } from "react";
import { useExchangeRate } from "../contexts/ExchangeRateContext";
import { formatBudget } from "../utils/formatting/formatBudget";

type CommonFormatOpts = {
  showCents?: boolean;
  includePlus?: boolean;
  singleCentDigit?: boolean;
};

/**
 * Callable returned by {@link useFormatBudget}. Overloaded so the secondary
 * CZK line is typed as possibly-absent, while every other call yields a string.
 */
export interface FormatBudgetFn {
  /**
   * Secondary CZK dual-display line (`≈ X Kč`). Returns `undefined` when there
   * is no CZK line to show — a US viewer, or a CZ viewer with no rate — so the
   * caller can render it conditionally without re-checking locale/rate:
   * `{secondary && <Text>…}` or `subStatistic={secondary}`.
   */
  (
    cents: number,
    opts: CommonFormatOpts & { asCzkSecondaryLine: true },
  ): string | undefined;
  /** Primary line (optionally forced to USD). Always returns a string. */
  (
    cents: number,
    opts?: CommonFormatOpts & {
      forcedCurrency?: "USD";
      asCzkSecondaryLine?: false;
    },
  ): string;
}

/**
 * Locale-aware money formatter.
 *
 * Returns a function that closes over the current viewer's locale and USD→CZK
 * rate (read from `ExchangeRateContext`). Must be called inside
 * `ExchangeRateProvider`.
 *
 * Behavior matrix (when called):
 * - Locale undefined or "US"                  → `$X.XX` (delegates to pure `formatBudget`)
 * - Locale "CZ" + `forcedCurrency:"USD"`      → `$X.XX` (dual-display primary line)
 * - Locale "CZ" + rate null/missing           → `$X.XX` (silent fallback)
 * - Locale "CZ" + valid rate                  → `X Kč` (rounded to whole Kč)
 * - Locale "CZ" + rate + `asCzkSecondaryLine` → `≈ X Kč` (dual-display secondary line)
 *
 * With `asCzkSecondaryLine`, when no CZK conversion is available (locale isn't
 * CZ, or the rate is missing) the function returns `undefined` so the caller
 * can skip rendering the secondary line.
 *
 * @example
 *   const formatBudget = useFormatBudget();
 *   formatBudget(1234);                                 // estimate / default → string
 *   formatBudget(1234, { forcedCurrency: "USD" });      // dual primary → string
 *   formatBudget(1234, { asCzkSecondaryLine: true });   // dual secondary → string | undefined
 */
export function useFormatBudget(): FormatBudgetFn {
  const { locale, rate } = useExchangeRate();

  const format = useCallback(
    (
      cents: number,
      opts: CommonFormatOpts & {
        forcedCurrency?: "USD";
        asCzkSecondaryLine?: boolean;
      } = {},
    ): string | undefined => {
      const {
        forcedCurrency,
        asCzkSecondaryLine,
        showCents,
        includePlus,
        singleCentDigit,
      } = opts;

      if (!Number.isFinite(cents)) return asCzkSecondaryLine ? undefined : "";

      const renderCzk =
        locale === "CZ" &&
        forcedCurrency !== "USD" &&
        typeof rate === "number" &&
        Number.isFinite(rate) &&
        rate > 0;

      if (renderCzk) {
        const czkWhole = Math.round((cents / 100) * (rate as number));
        let formatted: string;
        try {
          formatted = new Intl.NumberFormat("cs-CZ", {
            style: "currency",
            currency: "CZK",
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
          }).format(czkWhole);
        } catch {
          formatted = `${czkWhole} Kč`;
        }
        if (includePlus && czkWhole > 0) formatted = `+${formatted}`;
        return asCzkSecondaryLine ? `≈ ${formatted}` : formatted;
      }

      // No CZK conversion possible. Suppress the secondary line so callers
      // don't render a duplicate USD figure under the primary one.
      if (asCzkSecondaryLine) return undefined;

      return formatBudget(cents, { showCents, includePlus, singleCentDigit });
    },
    [locale, rate],
  );

  return format as FormatBudgetFn;
}
