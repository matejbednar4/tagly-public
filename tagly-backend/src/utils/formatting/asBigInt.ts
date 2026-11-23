// Converts bigint | number | string | null | undefined to bigint.
// Strings allowed:
// - "123", "  123  ", "+123", "-123"
// - "1_234", "1 234", "1 234", "1'234"
// - "1,234.56" (commas as thousands), "1.234,56" (comma as decimal)
// - "1.23", "-4.9", "1e6" (decimals/exponent -> truncated toward zero)
// Empty string, null, undefined -> 0n
export const asBigInt = (v: bigint | number | string | null | undefined): bigint => {
  if (typeof v === "bigint") {
    return v;
  }

  if (typeof v === "number") {
    return BigInt(Math.trunc(v));
  }

  if (v === null || v === undefined) {
    return 0n;
  }

  if (typeof v === "string") {
    // Normalize spaces (incl. NBSP), trim
    let s = v.replace(/\u00A0/g, " ").trim();
    if (s === "") {
      return 0n;
    }

    // Fast path: plain integer with optional spaces/underscores
    if (/^[+-]?\d[\d _]*$/.test(s)) {
      s = s.replace(/[ _]/g, "");
      return BigInt(s);
    }

    // Handle common thousands/decimal patterns
    const hasDot = s.includes(".");
    const hasComma = s.includes(",");

    if (hasComma && hasDot) {
      // Assume '.' is decimal and ',' are thousands -> drop commas
      s = s.replace(/,/g, "");
    } else if (hasComma && !hasDot) {
      // Assume comma is decimal separator
      s = s.replace(",", ".");
    }

    // Remove common thousands separators: spaces/thin spaces/apostrophes between digit groups
    s = s.replace(/(?<=\d)[ '\u202F\u00A0](?=\d{3}(\D|$))/g, "");

    // If now an integer, parse directly for full precision
    if (/^[+-]?\d+$/.test(s)) {
      return BigInt(s);
    }

    // Fallback: parse as Number (handles decimals/exponent), then truncate
    const num = Number(s);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      // Let BigInt throw with a clear signal for truly invalid strings
      return BigInt(s); // will throw
    }
    return BigInt(Math.trunc(num));
  }

  // Last resort: mirror original coercion
  return BigInt(String(v ?? "0"));
};