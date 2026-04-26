import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../roles.guard';
import { Role } from '../../enums/role.enum';

function createMockContext(role: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role
          ? { userId: 'u-1', organizationIds: ['org-1'], role }
          : undefined,
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockContext(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user has a required role', () => {
      reflector.getAllAndOverride.mockReturnValue([
        Role.FOUNDER,
        Role.SUPER_ADMIN,
      ]);
      const context = createMockContext(Role.FOUNDER);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow SUPER_ADMIN when required roles include SUPER_ADMIN', () => {
      reflector.getAllAndOverride.mockReturnValue([
        Role.SUPER_ADMIN,
        Role.FOUNDER,
      ]);
      const context = createMockContext(Role.SUPER_ADMIN);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user role is MEMBER and FOUNDER is required', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.FOUNDER]);
      const context = createMockContext(Role.MEMBER);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user has no role', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.FOUNDER]);
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
