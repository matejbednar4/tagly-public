import argon2 from "argon2";
import { PASSWORD_HASH_TUNABLES } from "../../constants/auth/PASSWORD_HASH.js";

/**
 * Argon2id password hashing (admin auth — advertisers and customers are
 * passwordless). Password
 * hashing is crypto for the password *feature*, not invariant infra.
 */

// Add pepper if configured
const withPepper = (plain: string): string => {
  return plain + PASSWORD_HASH_TUNABLES.pepper;
};

// Hash new passwords with current tunables
export async function hashPassword(plain: string): Promise<string> {
  const opts = {
    type: argon2.argon2id,
    timeCost: PASSWORD_HASH_TUNABLES.timeCost,
    memoryCost: PASSWORD_HASH_TUNABLES.memoryMiB * 1024,
    parallelism: PASSWORD_HASH_TUNABLES.parallelism,
  };
  return argon2.hash(withPepper(plain), opts);
}

// Verify existing hashes
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return argon2.verify(hash, withPepper(plain));
}
