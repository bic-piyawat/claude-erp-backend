import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { createMockUserWithMemberships } from '../mocks/auth.mock';
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
          useValue: { findActiveUserByEmail: jest.fn() },
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
      expect(result.user).toEqual({ id: user.id, email: user.email });
      expect(result.organizations).toEqual([
        { id: 'org-1', name: 'Acme Corporation', role: 'FOUNDER' },
      ]);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        organizationIds: ['org-1'],
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
            role: 'FOUNDER',
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
      });
    });
  });
});
