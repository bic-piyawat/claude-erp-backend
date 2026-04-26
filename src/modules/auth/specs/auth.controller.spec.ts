import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService, LoginResult } from '../auth.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import {
  ACTIVE_ORG_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  JWT_COOKIE_MAX_AGE_MS,
} from '../../../common/constants/auth.constant';
import {
  createMockMembership,
  createMockUserProfile,
} from '../mocks/auth.mock';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            getProfile: jest.fn(),
            listMemberships: jest.fn(),
            switchOrganization: jest.fn(),
            getNavigation: jest.fn(),
          },
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

  describe('GET /auth/me/memberships', () => {
    it('returns the service results wrapped in { data } preserving sort order', async () => {
      const sorted = [
        createMockMembership({ organizationName: 'Acme Corporation' }),
        createMockMembership({
          organizationId: 'org-g',
          organizationName: 'Globex LLC',
          role: 'MEMBER',
        }),
      ];
      service.listMemberships.mockResolvedValue(sorted);
      const req = {
        user: { userId: 'user-1', organizationIds: ['org-1', 'org-g'] },
        activeOrganizationId: 'org-1',
      } as unknown as Parameters<typeof controller.listMyMemberships>[0];

      const result = await controller.listMyMemberships(req);

      expect(service.listMemberships).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ data: sorted });
    });

    it('applies OrganizationGuard to the listMyMemberships handler', () => {
      const guards = new Reflector().get<unknown[]>(
        '__guards__',
        controller.listMyMemberships,
      );

      expect((guards ?? []).some((g) => g === OrganizationGuard)).toBe(true);
    });
  });

  describe('POST /auth/switch-org', () => {
    it('sets active_org HttpOnly cookie and returns wrapped membership data', async () => {
      const target = createMockMembership({
        organizationId: '00000000-0000-4000-8000-000000000002',
        organizationName: 'Globex LLC',
        role: 'MEMBER',
      });
      service.switchOrganization.mockResolvedValue({
        organizationId: target.organizationId,
        organizationName: target.organizationName,
        role: target.role,
      });
      const res = createMockResponse();
      const req = {
        user: {
          userId: 'user-1',
          organizationIds: [
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
          ],
        },
        activeOrganizationId: '00000000-0000-4000-8000-000000000001',
      } as unknown as Parameters<typeof controller.switchOrg>[1];

      const body = await controller.switchOrg(
        { organizationId: '00000000-0000-4000-8000-000000000002' },
        req,
        res,
      );

      expect(service.switchOrganization).toHaveBeenCalledWith(
        'user-1',
        [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        '00000000-0000-4000-8000-000000000002',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        ACTIVE_ORG_COOKIE_NAME,
        '00000000-0000-4000-8000-000000000002',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: JWT_COOKIE_MAX_AGE_MS,
          path: '/',
        }),
      );
      expect(body).toEqual({
        data: {
          organizationId: '00000000-0000-4000-8000-000000000002',
          organizationName: 'Globex LLC',
          role: 'MEMBER',
        },
      });
    });

    it('propagates ForbiddenException from the service and does not set the cookie', async () => {
      service.switchOrganization.mockRejectedValue(
        new ForbiddenException('Forbidden organization'),
      );
      const res = createMockResponse();
      const req = {
        user: {
          userId: 'user-1',
          organizationIds: ['00000000-0000-4000-8000-000000000001'],
        },
        activeOrganizationId: '00000000-0000-4000-8000-000000000001',
      } as unknown as Parameters<typeof controller.switchOrg>[1];

      await expect(
        controller.switchOrg(
          { organizationId: '00000000-0000-4000-8000-000000000002' },
          req,
          res,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('applies OrganizationGuard to the switchOrg handler', () => {
      const guards = new Reflector().get<unknown[]>(
        '__guards__',
        controller.switchOrg,
      );

      expect((guards ?? []).some((g) => g === OrganizationGuard)).toBe(true);
    });
  });

  describe('GET /auth/me/navigation', () => {
    it('returns the service result wrapped in { data } using the active org from the request', async () => {
      const items = [
        {
          key: 'overview',
          labelKey: 'Sidebar.organizationOverview',
          path: '/dashboard',
          icon: 'LayoutDashboard',
          order: 10,
        },
        {
          key: 'projects',
          labelKey: 'Sidebar.projects',
          path: '/projects',
          icon: 'FolderKanban',
          order: 20,
        },
      ];
      service.getNavigation.mockResolvedValue(items);
      const req = {
        user: { userId: 'user-1', organizationIds: ['org-1', 'org-2'] },
        activeOrganizationId: 'org-2',
      } as unknown as Parameters<typeof controller.getMyNavigation>[0];

      const result = await controller.getMyNavigation(req);

      expect(service.getNavigation).toHaveBeenCalledWith('user-1', 'org-2');
      expect(result).toEqual({ data: items });
    });

    it('applies OrganizationGuard to the getMyNavigation handler', () => {
      const guards = new Reflector().get<unknown[]>(
        '__guards__',
        controller.getMyNavigation,
      );

      expect((guards ?? []).some((g) => g === OrganizationGuard)).toBe(true);
    });
  });
});
