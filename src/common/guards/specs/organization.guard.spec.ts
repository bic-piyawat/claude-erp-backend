import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrganizationGuard } from '../organization.guard';
import { AUTH_COOKIE_NAME } from '../../constants/auth.constant';

interface MockRequest {
  cookies: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  user?: { userId: string; organizationIds: string[] };
  activeOrganizationId?: string;
}

function createMockContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    guard = new OrganizationGuard(jwtService);
  });

  it('should throw UnauthorizedException when access_token cookie is missing', async () => {
    const req: MockRequest = { cookies: {}, headers: {} };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'bad.token' },
      headers: { 'x-organization-id': 'org-1' },
    };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw BadRequestException when activeOrganizationId is missing from both header and cookie', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      organizationIds: ['org-1'],
    });
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'good.token' },
      headers: {},
    };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should throw ForbiddenException when active org is not in the user's JWT organizationIds", async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      organizationIds: ['org-1'],
    });
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'good.token' },
      headers: { 'x-organization-id': 'org-unauthorized' },
    };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should attach user + activeOrganizationId and return true when X-Organization-Id header matches', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      organizationIds: ['org-1', 'org-2'],
    });
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'good.token' },
      headers: { 'x-organization-id': 'org-2' },
    };

    const result = await guard.canActivate(createMockContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({
      userId: 'user-1',
      organizationIds: ['org-1', 'org-2'],
    });
    expect(req.activeOrganizationId).toBe('org-2');
  });

  it('should fall back to active_org cookie when header is absent', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      organizationIds: ['org-1'],
    });
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'good.token', active_org: 'org-1' },
      headers: {},
    };

    const result = await guard.canActivate(createMockContext(req));

    expect(result).toBe(true);
    expect(req.activeOrganizationId).toBe('org-1');
  });

  it('should prefer the header over the cookie when both are present', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      organizationIds: ['org-a', 'org-b'],
    });
    const req: MockRequest = {
      cookies: { [AUTH_COOKIE_NAME]: 'good.token', active_org: 'org-a' },
      headers: { 'x-organization-id': 'org-b' },
    };

    await guard.canActivate(createMockContext(req));

    expect(req.activeOrganizationId).toBe('org-b');
  });
});
