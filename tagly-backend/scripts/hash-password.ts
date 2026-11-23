import argon2 from "argon2";
import dotenv from "dotenv";

dotenv.config();

const withPepper = (plain: string): string => {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) {
    throw new Error("PASSWORD_PEPPER is not set in environment variables");
  }
  return plain + process.env.PASSWORD_PEPPER;
};

async function main() {
  const plain = process.env.ADMIN_PASSWORD;
  if (!plain) {
    console.error("No password");
    process.exit(1);
  }

  const opts = {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 32 * 1024,
    parallelism: 1,
  };
  const hash = await argon2.hash(withPepper(plain), opts);
  console.log(hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
