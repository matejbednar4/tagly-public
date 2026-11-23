import "dotenv/config";
import { defineConfig, env } from "prisma/config";

type Env = {
  DATABASE_URL: string;
};

const isDev = process.env.APP_STAGE === "development";

const databaseUrl = process.env.DATABASE_URL
  ? env<Env>("DATABASE_URL")
  : "postgresql://placeholder:placeholder@localhost:5432/placeholder"; // If it's NOT set (like App Runner build container), use a dummy URL

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    ...(isDev && {
      // Ensures the shadow DB used by `prisma migrate dev` has required schemas/extensions
      initShadowDb: `
        CREATE SCHEMA IF NOT EXISTS "app";
        CREATE SCHEMA IF NOT EXISTS "jobs";
        CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
        CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
      `,
    }),
  },
  experimental: {
    externalTables: true, // to be able to apply the dev migration
  },
  datasource: {
    url: databaseUrl,
  },
});
