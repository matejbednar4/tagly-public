export default {
  outFile: "src/db/types.ts",
  dialect: "postgres",
  schemas: ["app", "jobs", "public"],
} as const;
