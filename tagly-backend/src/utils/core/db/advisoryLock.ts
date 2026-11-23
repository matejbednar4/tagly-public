import { Client } from "pg";
import { envVariables } from "../../../environment/envVariables.js";
import { readRdsCa } from "./rdsCa.js";

/**
 * Runs a callback while holding a PostgreSQL session-level advisory lock.
 *
 * Uses a dedicated pg.Client (not the shared Prisma/Kysely pool) so that the
 * lock acquire and release are guaranteed to happen on the same session.
 * Mixing advisory lock calls with a connection pool is unsafe because each pool
 * checkout may return a different connection, breaking the session-level guarantee.
 *
 * Returns true if the lock was acquired and the callback ran, false if another
 * instance already holds the lock.
 */
export async function withAdvisoryLock(
  lockKey: bigint,
  callback: () => Promise<void>,
): Promise<boolean> {
  const needSsl = envVariables.APP_STAGE !== "development";

  const client = new Client({
    connectionString: envVariables.DATABASE_URL,
    ssl: needSsl
      ? {
          ca: readRdsCa(),
          rejectUnauthorized: true,
        }
      : false,
  });

  await client.connect();

  try {
    const key = lockKey.toString();
    const res = await client.query<{ got_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS got_lock",
      [key],
    );
    const gotLock = !!res.rows[0]?.got_lock;
    if (!gotLock) return false;

    try {
      await callback();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1::bigint)", [key]);
    }

    return true;
  } finally {
    await client.end();
  }
}
