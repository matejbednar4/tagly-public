import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { envVariables } from "../environment/envVariables.js";
import { readRdsCa } from "../utils/core/db/rdsCa.js";

const databaseUrl = envVariables.DATABASE_URL;
const needSsl = envVariables.APP_STAGE !== "development";

let ssl: any = false;

if (needSsl) {
  ssl = {
    ca: readRdsCa(),
    rejectUnauthorized: true,
  };
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: ssl,
});

const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });
export default prisma;
