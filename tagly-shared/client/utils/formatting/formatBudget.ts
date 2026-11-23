// Pure USD formatter. Used by non-localized contexts (admin dashboard, tests,
// raw utility code). For locale-aware formatting in the customer/advertiser
// apps use `useFormatBudget()` from `../hooks/useFormatBudget`, which reads
// locale + rate from `ExchangeRateContext`.
export function formatBudget(
  cents: number,
  opts: {
    showCents?: boolean;
    includePlus?: boolean;
    singleCentDigit?: boolean;
  } = {},
): string {
  if (!Number.isFinite(cents)) return "";

  const amount = cents / 100;
  const showCents = opts.showCents ?? true;
  const includePlus = opts.includePlus ?? false;
  const singleCentDigit = opts.singleCentDigit ?? false;

  let minimumFractionDigits: number;
  let maximumFractionDigits: number;
  if (!showCents) {
    minimumFractionDigits = 0;
    maximumFractionDigits = 0;
  } else if (singleCentDigit) {
    minimumFractionDigits = 1;
    maximumFractionDigits = 1;
  } else {
    minimumFractionDigits = 0;
    maximumFractionDigits = 2;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);

  if (includePlus && amount > 0) return `+${formatted}`;
  return formatted;
}
