import { prisma } from "../src/db/prisma.js";
import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoAccount, ensureRoles } from "../src/db/seed-data.js";

async function main() {
  await ensureRoles();
  console.log("Roles ready");
  if (process.argv.includes("--demo")) {
    const created = await ensureDemoAccount();
    console.log(`Demo account ${created ? "created" : "already exists"}: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }
}

main().finally(() => prisma.$disconnect());
