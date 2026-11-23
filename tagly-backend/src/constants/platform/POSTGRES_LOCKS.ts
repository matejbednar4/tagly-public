export const LOCK_KEYS = {
  JOB_MAINTENANCE: 0xf1ae0001n,
  DB_CLEANUP: 0xf1ae0002n,
  // Every ECS service deploys with maximumPercent=200 (live-audited, all 14),
  // so two task generations overlap on EVERY deploy. These three workers were
  // the ones without a singleton lock; the money ones relied entirely on CAS
  // claims + Stripe idempotency to survive the overlap — and the PAYG charge
  // path provably didn't (a racing settle books an idempotency_error as a card
  // decline). The lock closes the class in code, independent of ECS config.
  SHARE_PAYMENT: 0xf1ae0003n,
  STRIPE_RECONCILE: 0xf1ae0004n,
  NOTIFICATIONS: 0xf1ae0005n,
} as const;
