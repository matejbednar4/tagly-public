/**
 * Admin moderation-queue tunables (the Review tab). Queues serve a fixed page
 * of the OLDEST items plus the full outstanding total — no pagination: the
 * queues are meant to be worked to zero, and acting on an item removes it, so
 * a refresh naturally pulls the next oldest batch.
 */
export const ADMIN_REVIEW = {
  QUEUE_PAGE_SIZE: 10,
} as const;
