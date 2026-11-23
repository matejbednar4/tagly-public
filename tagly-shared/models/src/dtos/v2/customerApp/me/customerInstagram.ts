import { z } from "zod";

/**
 * The customer's linked Instagram account, as embedded in `CustomerMe`. Null on
 * `CustomerMe` when the customer hasn't connected Instagram.
 */
export const CustomerInstagramAccountSchema = z.object({
  username: z.string(),
  name: z.string().nullable(),
  pfpUrl: z.url().nullable(),
  followerCount: z.number(),
  accountType: z.string(),
  /**
   * True once the IG audience-snapshot worker has written a snapshot for this
   * account. While false (account just linked, snapshot still being taken) the
   * backend returns null reward estimates (`NO_SNAPSHOT`): the client shows the
   * "rewards calculating, available soon" state instead of a price and hides the
   * snapshot-dependent Discover shelves. Derived from snapshot existence on every
   * read (never denormalized), so it can't drift behind the worker, and matches
   * the existence check `calculateEstPrice` gates `NO_SNAPSHOT` on.
   */
  hasSnapshot: z.boolean(),
});

export type CustomerInstagramAccount = z.infer<
  typeof CustomerInstagramAccountSchema
>;
