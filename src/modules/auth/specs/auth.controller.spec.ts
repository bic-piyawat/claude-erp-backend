import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService, LoginResult } from '../auth.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import {
  AUTH_COOKIE_NAME,
  JWT_COOKIE_MAX_AGE_MS,
} from '../../../common/constants/auth.constant';
import { createMockUserProfile } from '../mocks/auth.mock';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: jest.fn(), getProfile: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'COOKIE_SECURE') return 'false';
              return fallback;
            }),
          },
        },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
  });

  function createMockResponse(): jest.Mocked<Pick<Response, 'cookie'>> &
    Response {
    const res: Partial<Response> = { cookie: jest.fn().mockReturnThis() };
    return res as jest.Mocked<Pick<Response, 'cookie'>> & Response;
  }

  describe('GET /auth/me', () => {
    it('should merge profile fields with org context from the request', async () => {
      const profile = createMockUserProfile({
        userId: 'user-1',
        email: 'founder@acme.test',
        firstName: 'Bic',
        lastName: 'Piyawat',
        avatarUrl: null,
      });
      service.getProfile.mockResolvedValue(profile);
      const req = {
        user: { userId: 'user-1', organizationIds: ['org-1', 'org-2'] },
        activeOrganizationId: 'org-2',
      } as unknown as Parameters<typeof controller.me>[0];

      const result = await controller.me(req);

      expect(service.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        userId: 'user-1',
        email: 'founder@acme.test',
        firstName: 'Bic',
        lastName: 'Piyawat',
        avatarUrl: null,
        organizationIds: ['org-1', 'org-2'],
        activeOrganizationId: 'org-2',
      });
    });
  });

  describe('POST /auth/login', () => {
    it('should set the JWT as HttpOnly cookie and return user + organizations (not the token)', async () => {
      // Arrange
      const loginResult: LoginResult = {
        accessToken: 'jwt.signed.value',
        user: {
          id: 'user-1',
          email: 'founder@acme.test',
          firstName: 'Bic',
          lastName: 'Piyawat',
          avatarUrl: null,
        },
        organizations: [{ id: 'org-1', name: 'Acme', role: 'FOUNDER' }],
      };
      service.login.mockResolvedValue(loginResult);
      const res = createMockResponse();

      // Act
      const body = await controller.login(
        { email: 'founder@acme.test', password: 'ChangeMe123!' },
        res,
      );

      // Assert
      expect(service.login).toHaveBeenCalledWith({
        email: 'founder@acme.test',
        password: 'ChangeMe123!',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt.signed.value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: JWT_COOKIE_MAX_AGE_MS,
          path: '/',
        }),
      );
      expect(body).toEqual({
        user: {
          id: 'user-1',
          email: 'founder@acme.test',
          firstName: 'Bic',
          lastName: 'Piyawat',
          avatarUrl: null,
        },
        organizations: [{ id: 'org-1', name: 'Acme', role: 'FOUNDER' }],
      });
      // The raw JWT must never appear in the response body
      expect(JSON.stringify(body)).not.toContain('jwt.signed.value');
    });
  });
});
