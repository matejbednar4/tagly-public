/**
 * Small display formatters for the admin tool. Admin is internal, English-only,
 * and USD-centric (Tampa) — so money is always rendered as `$X.XX`, no locale
 * plumbing. Keep these dumb: they format numbers the SDK already returned.
 */

/** Cents → `$1,234.56`. */
export function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Cents → `$1.2k` / `$3.4M` for tight stat tiles (big aggregates). */
export function formatUsdCompact(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return formatUsd(cents);
}

/** Integer with thousands separators. */
export function formatInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** A pre-computed percentage number (e.g. 12.3) → `12.3%`; null → `—`. */
export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}%`;
}

/** A signed percentage for deltas (MoM growth): `+12.3%` / `-4.5%`. */
export function formatSignedPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

/**
 * An ISO date → `Jul 23, 2026, 3:45 PM`. Admin always shows the time alongside
 * the date (a bare date loses the ordering/timing an admin usually needs) — use
 * this for every date the admin surfaces, not `toLocaleDateString`.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
