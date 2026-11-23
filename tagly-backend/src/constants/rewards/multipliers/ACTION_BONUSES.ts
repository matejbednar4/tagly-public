// Ordered tiers; first match wins based on reach <= maxReach
export const ACTION_BONUSES = {
  actions: [
    { key: "profileVisits", usd: 0.03, capPerKReach: 50 },
    { key: "follows", usd: 0.2, capPerKReach: 10 },
    { key: "saves", usd: 0.05, capPerKReach: 40 },
    { key: "shares", usd: 0.05, capPerKReach: 30 },
    { key: "comments", usd: 0.03, capPerKReach: 20 },
    { key: "likes", usd: 0.005, capPerKReach: 250 },
  ],

  viralDampenTiers: [
    { maxReach: 10_000, scale: 1.0 },
    { maxReach: 25_000, scale: 0.8 },
    { maxReach: 50_000, scale: 0.6 },
    { maxReach: 100_000, scale: 0.5 },
    { maxReach: Infinity, scale: 0.4 },
  ],
} as const;
