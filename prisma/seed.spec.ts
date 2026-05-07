import * as bcrypt from 'bcrypt';
import { runSeed, SeedConfig, SeedPrismaClient } from './seed.runner';
import { MembershipRoleEnum } from '../src/common/enums/membership-role.enum';

type CapturedOrg = { id: string; name: string };
type CapturedUser = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isFounder: boolean;
};
type CapturedMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
};

function createInMemoryPrisma(): {
  client: SeedPrismaClient;
  state: {
    orgs: CapturedOrg[];
    users: CapturedUser[];
    memberships: CapturedMembership[];
  };
} {
  const state = {
    orgs: [] as CapturedOrg[],
    users: [] as CapturedUser[],
    memberships: [] as CapturedMembership[],
  };

  const client: SeedPrismaClient = {
    organization: {
      upsert: jest.fn(async ({ where, create }) => {
        const existing = state.orgs.find((o) => o.name === where.name);
        if (existing) return existing;
        const created: CapturedOrg = {
          id: create.id ?? `org-${state.orgs.length + 1}`,
          name: create.name,
        };
        state.orgs.push(created);
        return created;
      }),
    },
    user: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = state.users.find((u) => u.email === where.email);
        if (existing) {
          existing.firstName = update.firstName;
          existing.lastName = update.lastName;
          if (typeof update.isFounder === 'boolean') {
            existing.isFounder = update.isFounder;
          }
          return existing;
        }
        const created: CapturedUser = {
          id: create.id ?? `user-${state.users.length + 1}`,
          email: create.email,
          password: create.password,
          firstName: create.firstName,
          lastName: create.lastName,
          avatarUrl: create.avatarUrl ?? null,
          isFounder: create.isFounder ?? false,
        };
        state.users.push(created);
        return created;
      }),
    },
    membership: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.userId_organizationId;
        const existing = state.memberships.find(
          (m) =>
            m.userId === key.userId && m.organizationId === key.organizationId,
        );
        if (existing) return existing;
        const created: CapturedMembership = {
          id: `mem-${state.memberships.length + 1}`,
          userId: create.userId,
          organizationId: create.organizationId,
          role: create.role,
        };
        state.memberships.push(created);
        return created;
      }),
    },
    stage: {
      upsert: jest.fn(async () => ({ id: `stage-mock` })),
      findFirst: jest.fn(async () => null),
    },
    organizationSettings: {
      upsert: jest.fn(async () => ({ id: `settings-mock` })),
    },
  };

  return { client, state };
}

function buildConfig(overrides: Partial<SeedConfig> = {}): SeedConfig {
  return {
    organizationName: 'Acme Corporation',
    userEmail: 'founder@acme.test',
    userPassword: 'ChangeMe123!',
    ...overrides,
  };
}

describe('runSeed', () => {
  it('should create one Organization with the configured name', async () => {
    // Arrange
    const { client, state } = createInMemoryPrisma();
    const config = buildConfig({ organizationName: 'Acme Corporation' });

    // Act
    await runSeed(client, config);

    // Assert
    expect(state.orgs).toHaveLength(1);
    expect(state.orgs[0].name).toBe('Acme Corporation');
  });

  it('should create one User with the configured email', async () => {
    const { client, state } = createInMemoryPrisma();
    const config = buildConfig({ userEmail: 'founder@acme.test' });

    await runSeed(client, config);

    expect(state.users).toHaveLength(1);
    expect(state.users[0].email).toBe('founder@acme.test');
  });

  it('should seed founder with firstName + lastName', async () => {
    // Arrange
    const { client, state } = createInMemoryPrisma();

    // Act
    await runSeed(client, buildConfig());

    // Assert
    expect(state.users).toHaveLength(1);
    expect(state.users[0].firstName).toBe('Bic');
    expect(state.users[0].lastName).toBe('Piyawat');
  });

  it('should respect upsert idempotency on second run (founder profile fields)', async () => {
    // Arrange
    const { client, state } = createInMemoryPrisma();
    const config = buildConfig();

    // Act
    await runSeed(client, config);
    await runSeed(client, config);

    // Assert
    expect(state.users).toHaveLength(1);
    expect(state.users[0].firstName).toBe('Bic');
    expect(state.users[0].lastName).toBe('Piyawat');
  });

  it('should bcrypt-hash the user password (never store plaintext)', async () => {
    const { client, state } = createInMemoryPrisma();
    const plaintext = 'ChangeMe123!';

    await runSeed(client, buildConfig({ userPassword: plaintext }));

    const stored = state.users[0].password;
    expect(stored).not.toBe(plaintext);
    expect(await bcrypt.compare(plaintext, stored)).toBe(true);
  });

  it('should create a Membership linking user to org with role SUPER_ADMIN (FOUNDER is now system-level)', async () => {
    const { client, state } = createInMemoryPrisma();

    await runSeed(client, buildConfig());

    expect(state.memberships).toHaveLength(1);
    const membership = state.memberships[0];
    expect(membership.userId).toBe(state.users[0].id);
    expect(membership.organizationId).toBe(state.orgs[0].id);
    // FOUNDER lives on User.isFounder (system-level). Per-org admin =
    // SUPER_ADMIN on Membership.role.
    expect(membership.role).toBe(MembershipRoleEnum.SUPER_ADMIN);
  });

  it('should mark the seeded founder user as a system-level FOUNDER (User.isFounder = true)', async () => {
    const { client, state } = createInMemoryPrisma();

    await runSeed(client, buildConfig());

    expect(state.users).toHaveLength(1);
    expect(state.users[0].isFounder).toBe(true);
  });

  it('should be idempotent — running twice does not duplicate records', async () => {
    const { client, state } = createInMemoryPrisma();
    const config = buildConfig();

    await runSeed(client, config);
    await runSeed(client, config);

    expect(state.orgs).toHaveLength(1);
    expect(state.users).toHaveLength(1);
    expect(state.memberships).toHaveLength(1);
  });

  describe('optional second organization', () => {
    it('should not create a second org when secondOrganizationName is not provided', async () => {
      const { client, state } = createInMemoryPrisma();

      await runSeed(client, buildConfig());

      expect(state.orgs).toHaveLength(1);
      expect(state.memberships).toHaveLength(1);
    });

    it('should create a second org and membership with the provided role when secondOrganizationName is set', async () => {
      const { client, state } = createInMemoryPrisma();

      await runSeed(
        client,
        buildConfig({
          secondOrganizationName: 'Globex LLC',
          secondOrganizationRole: 'MEMBER',
        }),
      );

      expect(state.orgs).toHaveLength(2);
      expect(state.orgs.map((o) => o.name)).toEqual([
        'Acme Corporation',
        'Globex LLC',
      ]);
      expect(state.memberships).toHaveLength(2);
      const second = state.memberships[1];
      expect(second.userId).toBe(state.users[0].id);
      expect(second.organizationId).toBe(state.orgs[1].id);
      expect(second.role).toBe('MEMBER');
    });

    it('should default the second membership role to MEMBER when only the name is provided', async () => {
      const { client, state } = createInMemoryPrisma();

      await runSeed(
        client,
        buildConfig({ secondOrganizationName: 'Globex LLC' }),
      );

      expect(state.memberships).toHaveLength(2);
      expect(state.memberships[1].role).toBe(MembershipRoleEnum.MEMBER);
    });

    it('should remain idempotent when re-run with the second org configured', async () => {
      const { client, state } = createInMemoryPrisma();
      const config = buildConfig({ secondOrganizationName: 'Globex LLC' });

      await runSeed(client, config);
      await runSeed(client, config);

      expect(state.orgs).toHaveLength(2);
      expect(state.memberships).toHaveLength(2);
    });
  });
});
