import { PrismaClient } from "@prisma/client";
import { ROLES } from "../src/data/roles.js";

const prisma = new PrismaClient();

async function main() {
  for (const [i, role] of ROLES.entries()) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: { ...role, sortOrder: i },
      create: { ...role, sortOrder: i },
    });
  }
  console.log(`Seeded ${ROLES.length} roles`);
}

main().finally(() => prisma.$disconnect());
