import { envVariables } from "../../environment/envVariables.js";

/**
 * Argon2id password-hash tunables (admin passwords). Argon2 self-describes its
 * params in the hash string, so a stored hash keeps verifying regardless of which
 * tunables are current — retuning is safe.
 */
export const PASSWORD_HASH_TUNABLES = {
  algorithm: "argon2id",
  timeCost: 3, // iterations
  memoryMiB: 32, // MiB (converted to KiB for lib)
  parallelism: 1, // lanes/threads
  targetP95Ms: 200,
  pepper: envVariables.PASSWORD_PEPPER,
} as const;
