import prisma from "../../prisma/prisma.js";
import { hashPassword } from "../../utils/auth/hashPassword.js";
import { generateUid } from "../../utils/core/uids/generateUid.js";
import { envVariables } from "../../environment/envVariables.js";
import { Prisma } from "../../generated/prisma/client.js";

// The seeded admin's password comes from your local .env, never from source.
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
if (!SEED_ADMIN_PASSWORD) {
  throw new Error(
    "SEED_ADMIN_PASSWORD is not set. Add it to tagly-backend/.env before seeding.",
  );
}

export const ADMINS: Prisma.AdminCreateInput[] = [
  {
    email: "sales@taglyapp.com",
    passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
    role: "SUPER",
    username: "Tagly",
    uid: generateUid("ADMIN"),
  },
];

async function main() {
  if (
    envVariables.APP_STAGE !== "development" &&
    envVariables.APP_STAGE !== "staging"
  ) {
    return;
  }

  for (const admin of ADMINS) {
    const upserted = await prisma.admin.upsert({
      where: { email: admin.email },
      update: { passwordHash: admin.passwordHash, isActive: true },
      create: {
        uid: admin.uid,
        email: admin.email,
        username: admin.username,
        passwordHash: admin.passwordHash,
        isActive: true,
        role: admin.role,
      },
    });

    console.log(`Created admin "${upserted.username}"`);
  }
}

export { main as seedAdmin };

// Only run if executed directly
const isDirectExecution =
  process.argv[1]?.includes("admin.ts") ||
  process.argv[1]?.includes("admin.js");
if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error("Admin seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
