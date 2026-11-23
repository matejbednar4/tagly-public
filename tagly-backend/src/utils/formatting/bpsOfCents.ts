// round half-up for basis points (e.g., 30% = 3000 bps)
export const bpsOfCents = (cents: bigint, bps: number) => {
  return (cents * BigInt(bps) + 5000n) / 10000n;
};
