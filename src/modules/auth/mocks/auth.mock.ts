import { MembershipRoleEnum } from '../../../common/enums/membership-role.enum';

export interface MockUserWithMemberships {
  id: string;
  email: string;
  password: string;
  isDeleted: boolean;
  memberships: {
    organizationId: string;
    role: string;
    organization: { id: string; name: string };
  }[];
}

export function createMockUserWithMemberships(
  overrides: Partial<MockUserWithMemberships> = {},
): MockUserWithMemberships {
  return {
    id: 'user-1',
    email: 'founder@acme.test',
    password: '$2b$10$hashedpasswordplaceholder',
    isDeleted: false,
    memberships: [
      {
        organizationId: 'org-1',
        role: MembershipRoleEnum.FOUNDER,
        organization: { id: 'org-1', name: 'Acme Corporation' },
      },
    ],
    ...overrides,
  };
}

export function createMockLoginDto(
  overrides: Partial<{ email: string; password: string }> = {},
): {
  email: string;
  password: string;
} {
  return {
    email: 'founder@acme.test',
    password: 'ChangeMe123!',
    ...overrides,
  };
}
