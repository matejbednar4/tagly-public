export const VISIBILITY_BUDGETS = {
  // Visibility and shareability are one concept — a business is "accessible"
  // (visible == shareable) when its advertiser has at least this much AVAILABLE
  // budget (or is on PAYG / subsidized). One threshold, one rule
  // (`utils/businesses/businessAccessibility.ts`).
  MIN_VISIBILITY_BUDGET_CENTS: 1500, // $15 available budget to be visible+shareable

  // "Ending soon" scarcity signal, expressed as a MARGIN on top of the
  // visibility floor. A credits-only business is flagged as running low / may
  // disappear soon when its remaining funding capacity drops below
  // MIN_VISIBILITY_BUDGET_CENTS + LOW_BUDGET_WARNING_MARGIN_CENTS. Keeping it a
  // margin (not an absolute) means the warning band always sits just above the
  // floor: change the floor and the warning threshold follows.
  LOW_BUDGET_WARNING_MARGIN_CENTS: 5000, // warn below floor + $50 of headroom
};
