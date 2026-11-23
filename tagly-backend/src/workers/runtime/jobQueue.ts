/**
 * Shared primitives over the `jobs.*Queue` tables. All three queue tables
 * (`instagramInsightsQueue`, `instagramSnapshotQueue`, `notificationQueue`)
 * share the exact same `JobStatus` lifecycle columns (`status`, `scheduledAt`,
 * `startedAt`, `processingDeadline`, `finishedAt`, `attempts`, `lastError`), so
 * the claim CAS and the terminal transitions are written once here, generic over
 * a minimal Prisma delegate.
 */

/** The minimal Prisma-delegate surface the queue primitives need. */
export type JobQueueDelegate = {
  findMany: (args: any) => Promise<any[]>;
  updateMany: (args: any) => Promise<{ count: number }>;
  update: (args: any) => Promise<unknown>;
};

/**
 * What a `claim` receives from the runner. Includes the `table` so custom claims
 * (e.g. insights' two-phase claim) don't have to import prisma themselves.
 */
export type ClaimContext = {
  now: Date;
  batchSize: number;
  leaseMs: number;
  table: JobQueueDelegate;
};

/** The lifecycle writes, identical across every queue table. */
export type JobTransitions = {
  markDone: (id: number) => Promise<void>;
  failJob: (id: number, err: unknown) => Promise<void>;
  reschedule: (id: number, at: Date) => Promise<void>;
  /**
   * Voluntary deferral (job returned `DeferJob`): back to SCHEDULED at `at`,
   * and — unlike `reschedule` — the claim-time `attempts` increment is undone,
   * so waiting (quiet hours, a sibling job) never eats into the retry budget.
   */
  deferJob: (id: number, at: Date) => Promise<void>;
};

export function makeJobTransitions(table: JobQueueDelegate): JobTransitions {
  return {
    markDone: async (id) => {
      await table.update({
        where: { id },
        data: { status: "DONE", finishedAt: new Date(), lastError: null },
      });
    },
    failJob: async (id, err) => {
      const msg =
        (typeof err === "string" ? err : (err as any)?.message) ??
        "Unknown error";
      await table.update({
        where: { id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: String(msg).slice(0, 255),
        },
      });
    },
    reschedule: async (id, at) => {
      await table.update({
        where: { id },
        data: {
          status: "SCHEDULED",
          scheduledAt: at,
          startedAt: null,
          processingDeadline: null,
          lastError: null,
        },
      });
    },
    deferJob: async (id, at) => {
      await table.update({
        where: { id },
        data: {
          status: "SCHEDULED",
          scheduledAt: at,
          startedAt: null,
          processingDeadline: null,
          lastError: null,
          attempts: { decrement: 1 },
        },
      });
    },
  };
}

/**
 * Atomically claim SCHEDULED rows by id: flip to PROCESSING, set the lease, and
 * increment `attempts` — all guarded so a row another worker already took is
 * skipped. Returns the ids this worker actually won.
 *
 * `extraWhere` re-applies the due condition (e.g. `scheduledAt <= now`,
 * `validUntil > now`) inside the CAS so the claim is atomic against it. Used
 * directly by the insights worker's two-phase (expiring-first) claim.
 */
export async function claimJobsByIds(
  table: JobQueueDelegate,
  opts: {
    ids: number[];
    now: Date;
    leaseMs: number;
    extraWhere?: Record<string, unknown>;
  },
): Promise<number[]> {
  if (opts.ids.length === 0) return [];
  const res = await table.updateMany({
    where: { id: { in: opts.ids }, status: "SCHEDULED", ...opts.extraWhere },
    data: {
      status: "PROCESSING",
      startedAt: opts.now,
      processingDeadline: new Date(opts.now.getTime() + opts.leaseMs),
      attempts: { increment: 1 },
    },
  });
  if (res.count === 0) return [];
  // `startedAt: opts.now` scopes the re-fetch to the rows THIS claim actually
  // won — without it, rows a concurrent worker flipped to PROCESSING in the
  // same window would hydrate here too and be executed by both (double send).
  const claimed = await table.findMany({
    where: { id: { in: opts.ids }, status: "PROCESSING", startedAt: opts.now },
    select: { id: true },
  });
  return claimed.map((r: { id: number }) => r.id);
}

/**
 * One-phase claim: find the oldest due SCHEDULED rows, claim them atomically,
 * and return them hydrated with `select`. This is the common path (snapshot,
 * notifications). `where` is the due condition, applied to both the initial scan
 * and the CAS.
 */
export async function claimDueJobs<J>(
  table: JobQueueDelegate,
  opts: {
    now: Date;
    batchSize: number;
    leaseMs: number;
    where: Record<string, unknown>;
    orderBy: unknown;
    select: Record<string, unknown>;
  },
): Promise<J[]> {
  const due = await table.findMany({
    where: { status: "SCHEDULED", ...opts.where },
    orderBy: opts.orderBy,
    take: opts.batchSize,
    select: { id: true },
  });
  if (due.length === 0) return [];
  const ids = due.map((r: { id: number }) => r.id);

  const res = await table.updateMany({
    where: { id: { in: ids }, status: "SCHEDULED", ...opts.where },
    data: {
      status: "PROCESSING",
      startedAt: opts.now,
      processingDeadline: new Date(opts.now.getTime() + opts.leaseMs),
      attempts: { increment: 1 },
    },
  });
  if (res.count === 0) return [];

  // `startedAt: opts.now` scopes hydration to the rows THIS claim's CAS won.
  // Without it, a competing worker instance that claimed part of `ids` in the
  // same window would have its rows hydrated (and executed) here too.
  return table.findMany({
    where: { id: { in: ids }, status: "PROCESSING", startedAt: opts.now },
    select: opts.select,
    orderBy: opts.orderBy,
  }) as Promise<J[]>;
}
