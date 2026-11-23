export const FREQUENCY_MULTIPLIER = {
  weakBelowBps: 5_000, // Below 0.5x is WEAK
  strongAboveBps: 9_000, // Above 0.9x is STRONG
  perDay: {
    firstShare: 1.0,
    secondShareDifferentBusiness: 0.35,
    secondShareSameBusiness: 0.0,
    thirdOrMore: 0.1,
  },
  perWeek: {
    first: 1.0, // 1st–3rd
    second: 1.0,
    third: 0.85,
    fourth: 0.55,
    fifth: 0.35,
    sixthOrMore: 0.2,
  },
  minOverall: 0.05, // floor after multiplying day×week
};
