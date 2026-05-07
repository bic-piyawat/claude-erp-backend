import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import {
  createMockMembership,
  createMockUserProfile,
  createMockUserWithMemberships,
} from '../mocks/auth.mock';
import { BCRYPT_SALT_ROUNDS } from '../../../common/constants/auth.constant';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findActiveUserByEmail: jest.fn(),
            findUserProfileById: jest.fn(),
            findMembershipsByUserId: jest.fn(),
            findRoleForUserInOrg: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    repository = module.get(AuthRepository);
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('should return user, organizations, and a signed JWT when credentials are valid', async () => {
      // Arrange
      const plaintext = 'ChangeMe123!';
      const hashed = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
      const user = createMockUserWithMemberships({ password: hashed });
      repository.findActiveUserByEmail.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      // Act
      const result = await service.login({
        email: user.email,
        password: plaintext,
      });

      // Assert
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        firstName: 'Bic',
        lastName: 'Piyawat',
        avatarUrl: null,
        isFounder: true,
      });
      expect(result.organizations).toEqual([
        { id: 'org-1', name: 'Acme Corporation', role: 'SUPER_ADMIN' },
      ]);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        organizationIds: ['org-1'],
        isFounder: true,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      repository.findActiveUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@x.com', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      const hashed = await bcrypt.hash('correct-password', BCRYPT_SALT_ROUNDS);
      repository.findActiveUserByEmail.mockResolvedValue(
        createMockUserWithMemberships({ password: hashed }),
      );

      await expect(
        service.login({
          email: 'founder@acme.test',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should include every organization the user is a member of', async () => {
      const plaintext = 'pw';
      const hashed = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
      const user = createMockUserWithMemberships({
        password: hashed,
        memberships: [
          {
            organizationId: 'org-a',
            role: 'SUPER_ADMIN',
            organization: { id: 'org-a', name: 'A' },
          },
          {
            organizationId: 'org-b',
            role: 'MEMBER',
            organization: { id: 'org-b', name: 'B' },
          },
        ],
      });
      repository.findActiveUserByEmail.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('jwt');

      const result = await service.login({
        email: user.email,
        password: plaintext,
      });

      expect(result.organizations).toHaveLength(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        organizationIds: ['org-a', 'org-b'],
        isFounder: true,
      });
    });

    it('should sign isFounder=false in the JWT for non-founder users', async () => {
      const plaintext = 'pw';
      const hashed = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
      const user = createMockUserWithMemberships({
        password: hashed,
        isFounder: false,
        memberships: [
          {
            organizationId: 'org-1',
            role: 'MEMBER',
            organization: { id: 'org-1', name: 'Acme' },
          },
        ],
      });
      repository.findActiveUserByEmail.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('jwt');

      const result = await service.login({
        email: user.email,
        password: plaintext,
      });

      expect(result.user.isFounder).toBe(false);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        organizationIds: ['org-1'],
        isFounder: false,
      });
    });
  });

  describe('getProfile', () => {
    it('returns profile fields for active user', async () => {
      const profile = createMockUserProfile();
      repository.findUserProfileById.mockResolvedValue(profile);

      const result = await service.getProfile(profile.userId);

      expect(repository.findUserProfileById).toHaveBeenCalledWith(
        profile.userId,
      );
      expect(result).toEqual({
        userId: profile.userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        isFounder: profile.isFounder,
      });
    });

    it('throws NotFoundException when user is missing', async () => {
      repository.findUserProfileById.mockResolvedValue(null);

      await expect(service.getProfile('missing-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listMemberships', () => {
    it('returns memberships sorted alphabetically by organizationName (case-insensitive)', async () => {
      repository.findMembershipsByUserId.mockResolvedValue([
        createMockMembership({ organizationName: 'zeta industries' }),
        createMockMembership({ organizationName: 'Acme Corporation' }),
        createMockMembership({ organizationName: 'beta LLC' }),
      ]);

      const result = await service.listMemberships('user-1');

      expect(repository.findMembershipsByUserId).toHaveBeenCalledWith('user-1');
      expect(result.map((m) => m.organizationName)).toEqual([
        'Acme Corporation',
        'beta LLC',
        'zeta industries',
      ]);
    });

    it('returns an empty array when the user has no memberships', async () => {
      repository.findMembershipsByUserId.mockResolvedValue([]);

      expect(await service.listMemberships('user-with-none')).toEqual([]);
    });
  });

  describe('switchOrganization', () => {
    it('returns the target membership when the user belongs to it', async () => {
      const target = createMockMembership({
        organizationId: 'org-2',
        organizationName: 'Globex LLC',
        role: 'MEMBER',
      });
      repository.findMembershipsByUserId.mockResolvedValue([
        createMockMembership(),
        target,
      ]);

      const result = await service.switchOrganization(
        'user-1',
        ['org-1', 'org-2'],
        'org-2',
      );

      expect(result).toEqual({
        organizationId: 'org-2',
        organizationName: 'Globex LLC',
        role: 'MEMBER',
      });
    });

    it('throws ForbiddenException when target org is not in the JWT organizationIds list', async () => {
      await expect(
        service.switchOrganization('user-1', ['org-1'], 'org-2'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.findMembershipsByUserId).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when JWT lists the org but membership row is missing', async () => {
      repository.findMembershipsByUserId.mockResolvedValue([
        createMockMembership(),
      ]);

      await expect(
        service.switchOrganization('user-1', ['org-1', 'org-2'], 'org-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getNavigation', () => {
    it('FOUNDER → base + customFields + platformSettings', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue('FOUNDER');

      const items = await service.getNavigation('u1', 'org-1');

      expect(repository.findRoleForUserInOrg).toHaveBeenCalledWith(
        'u1',
        'org-1',
      );
      expect(items.map((i) => i.key)).toEqual([
        'overview',
        'projects',
        'customFields',
        'platformSettings',
      ]);
    });

    it('SUPER_ADMIN → base + customFields + orgSettings', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue('SUPER_ADMIN');

      const items = await service.getNavigation('u1', 'org-1');

      expect(items.map((i) => i.key)).toEqual([
        'overview',
        'projects',
        'customFields',
        'orgSettings',
      ]);
    });

    it('ADMIN → base only', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue('ADMIN');

      const items = await service.getNavigation('u1', 'org-1');

      expect(items.map((i) => i.key)).toEqual(['overview', 'projects']);
    });

    it('MEMBER → base only', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue('MEMBER');

      const items = await service.getNavigation('u1', 'org-1');

      expect(items.map((i) => i.key)).toEqual(['overview', 'projects']);
    });

    it('unrecognised role → falls back to base (defensive, never throws)', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue('SOME_FUTURE_ROLE');

      const items = await service.getNavigation('u1', 'org-1');

      expect(items.map((i) => i.key)).toEqual(['overview', 'projects']);
    });

    it('throws NotFoundException when no membership row exists for the active org', async () => {
      repository.findRoleForUserInOrg.mockResolvedValue(null);

      await expect(service.getNavigation('u1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
