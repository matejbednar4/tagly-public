import { Pool } from "pg";
import fs from "fs";

// 1) Put your STAGING (or PROD) DATABASE_URL here temporarily
//    or read from env: process.env.DATABASE_URL
const connectionString = process.env.DATABASE_URL!;


// 2) Same SSL config as in prisma.ts
const ca = fs.readFileSync(
  new URL("../global-bundle.pem", import.meta.url),
  "utf8"
);

console.log("CA length:", ca.length);

const pool = new Pool({
  connectionString,
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

async function main() {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    console.log("DB result:", result.rows);
  } catch (err) {
    console.error("DB error:", err);
  } finally {
    await pool.end();
  }
}

main();
