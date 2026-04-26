import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/common/constants/auth.constant';
import { MembershipRoleEnum } from '../src/common/enums/membership-role.enum';

export interface SeedConfig {
  organizationName: string;
  userEmail: string;
  userPassword: string;
  secondOrganizationName?: string;
  secondOrganizationRole?: string;
}

export interface SeedPrismaClient {
  organization: {
    upsert: (args: {
      where: { name: string };
      create: { id?: string; name: string };
      update: Record<string, never>;
    }) => Promise<{ id: string; name: string }>;
  };
  user: {
    upsert: (args: {
      where: { email: string };
      create: {
        id?: string;
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
      };
      update: { firstName: string; lastName: string };
    }) => Promise<{
      id: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    }>;
  };
  membership: {
    upsert: (args: {
      where: {
        userId_organizationId: { userId: string; organizationId: string };
      };
      create: { userId: string; organizationId: string; role: string };
      update: Record<string, never>;
    }) => Promise<{
      id: string;
      userId: string;
      organizationId: string;
      role: string;
    }>;
  };
  stage: {
    upsert: (args: {
      where: { id: string };
      create: {
        name: string;
        order: number;
        isStandard: boolean;
        organizationId: string;
      };
      update: Record<string, never>;
    }) => Promise<{ id: string }>;
    findFirst: (args: {
      where: { name: string; organizationId: string; isStandard: boolean };
    }) => Promise<{ id: string } | null>;
  };
  organizationSettings: {
    upsert: (args: {
      where: { organizationId: string };
      create: { organizationId: string; vatRate: number };
      update: Record<string, never>;
    }) => Promise<{ id: string }>;
  };
}

const STANDARD_STAGES = [
  { name: 'Lead', order: 1 },
  { name: 'Qualification', order: 2 },
  { name: 'Proposal', order: 3 },
  { name: 'Negotiation', order: 4 },
  { name: 'Closed Won', order: 5 },
  { name: 'Closed Lost', order: 6 },
];

async function seedOrgExtras(
  prisma: SeedPrismaClient,
  organizationId: string,
): Promise<void> {
  await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: { organizationId, vatRate: 7 },
    update: {},
  });

  for (const stage of STANDARD_STAGES) {
    const existing = await prisma.stage.findFirst({
      where: { name: stage.name, organizationId, isStandard: true },
    });
    if (!existing) {
      await prisma.stage.upsert({
        where: { id: `seed-${organizationId}-stage-${stage.order}` },
        create: {
          name: stage.name,
          order: stage.order,
          isStandard: true,
          organizationId,
        },
        update: {},
      });
    }
  }
}

export async function runSeed(
  prisma: SeedPrismaClient,
  config: SeedConfig,
): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { name: config.organizationName },
    create: { name: config.organizationName },
    update: {},
  });

  await seedOrgExtras(prisma, organization.id);

  const hashedPassword = await bcrypt.hash(
    config.userPassword,
    BCRYPT_SALT_ROUNDS,
  );
  const user = await prisma.user.upsert({
    where: { email: config.userEmail },
    create: {
      email: config.userEmail,
      password: hashedPassword,
      firstName: 'Bic',
      lastName: 'Piyawat',
    },
    update: { firstName: 'Bic', lastName: 'Piyawat' },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: MembershipRoleEnum.FOUNDER,
    },
    update: {},
  });

  if (config.secondOrganizationName) {
    const secondOrg = await prisma.organization.upsert({
      where: { name: config.secondOrganizationName },
      create: { name: config.secondOrganizationName },
      update: {},
    });

    await seedOrgExtras(prisma, secondOrg.id);

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: secondOrg.id,
        },
      },
      create: {
        userId: user.id,
        organizationId: secondOrg.id,
        role: config.secondOrganizationRole ?? MembershipRoleEnum.MEMBER,
      },
      update: {},
    });
  }
}
