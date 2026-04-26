import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditTrailInterceptor } from '../audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function createMockContext(
  method: string,
  extras?: Partial<{
    userId: string;
    organizationId: string;
    body: Record<string, unknown>;
    params: Record<string, string>;
    path: string;
  }>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        user: extras?.userId ? { userId: extras.userId } : undefined,
        activeOrganizationId: extras?.organizationId,
        body: extras?.body ?? {},
        params: extras?.params ?? { id: 'entity-1' },
        path: extras?.path ?? '/customers/entity-1',
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('AuditTrailInterceptor', () => {
  let interceptor: AuditTrailInterceptor;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as jest.Mocked<PrismaService>;
    interceptor = new AuditTrailInterceptor(prisma);
  });

  describe('intercept', () => {
    it('should skip audit log for GET requests', (done) => {
      const context = createMockContext('GET', {
        userId: 'u-1',
        organizationId: 'org-1',
      });
      const next = { handle: () => of({ id: '1' }) };

      interceptor.intercept(context, next).subscribe(() => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      });
    });

    it('should skip audit log for POST requests', (done) => {
      const context = createMockContext('POST', {
        userId: 'u-1',
        organizationId: 'org-1',
      });
      const next = { handle: () => of({ id: '1' }) };

      interceptor.intercept(context, next).subscribe(() => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      });
    });

    it('should write audit log for PATCH requests', (done) => {
      const context = createMockContext('PATCH', {
        userId: 'u-1',
        organizationId: 'org-1',
        body: { name: 'New Name' },
        params: { id: 'cust-1' },
        path: '/customers/cust-1',
      });
      const next = { handle: () => of({ id: 'cust-1' }) };

      interceptor.intercept(context, next).subscribe(() => {
        setTimeout(() => {
          expect(prisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                action: 'PATCH',
                entityType: 'Customer',
                entityId: 'cust-1',
                userId: 'u-1',
                organizationId: 'org-1',
              }),
            }),
          );
          done();
        }, 10);
      });
    });

    it('should write audit log for DELETE requests', (done) => {
      const context = createMockContext('DELETE', {
        userId: 'u-1',
        organizationId: 'org-1',
        params: { id: 'cust-2' },
        path: '/customers/cust-2',
      });
      const next = { handle: () => of(null) };

      interceptor.intercept(context, next).subscribe(() => {
        setTimeout(() => {
          expect(prisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                action: 'DELETE',
                entityId: 'cust-2',
              }),
            }),
          );
          done();
        }, 10);
      });
    });

    it('should skip audit log when userId is missing', (done) => {
      const context = createMockContext('PATCH', { organizationId: 'org-1' });
      const next = { handle: () => of({ id: '1' }) };

      interceptor.intercept(context, next).subscribe(() => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      });
    });

    it('should not throw when audit log write fails', (done) => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );
      const context = createMockContext('PATCH', {
        userId: 'u-1',
        organizationId: 'org-1',
        params: { id: 'e-1' },
        path: '/projects/e-1',
      });
      const next = { handle: () => of({ id: 'e-1' }) };

      interceptor.intercept(context, next).subscribe({
        next: () => done(),
        error: () => done(new Error('Should not throw')),
      });
    });
  });
});
