import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./types.js";
import { envVariables } from "../environment/envVariables.js";
import { readRdsCa } from "../utils/core/db/rdsCa.js";

const needSsl = envVariables.APP_STAGE !== "development";
const ssl = needSsl // so app runner can access the RDS db via kysely
  ? { ca: readRdsCa() }
  : undefined;

const pool = new pg.Pool({
  connectionString: envVariables.DATABASE_URL,
  ssl,
});

pool.on("connect", (client) => {
  client.query("SET search_path TO app, jobs, public"); // order matters
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});

export async function shutdownDb() {
  await db.destroy();
}
