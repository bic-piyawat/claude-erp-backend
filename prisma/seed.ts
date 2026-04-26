import { PrismaClient } from '@prisma/client';
import { runSeed, SeedConfig } from './seed.runner';

function loadConfig(): SeedConfig {
  const organizationName = process.env.SEED_ORGANIZATION_NAME;
  const userEmail = process.env.SEED_USER_EMAIL;
  const userPassword = process.env.SEED_USER_PASSWORD;

  if (!organizationName || !userEmail || !userPassword) {
    throw new Error(
      'Seed config missing: SEED_ORGANIZATION_NAME, SEED_USER_EMAIL, SEED_USER_PASSWORD must be set',
    );
  }

  return {
    organizationName,
    userEmail,
    userPassword,
    secondOrganizationName:
      process.env.SEED_SECOND_ORGANIZATION_NAME || undefined,
    secondOrganizationRole: process.env.SEED_SECOND_ROLE || undefined,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await runSeed(prisma, loadConfig());
    // eslint-disable-next-line no-console
    console.log('Seed complete');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
