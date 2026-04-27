import { Test, TestingModule } from '@nestjs/testing';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { BudgetController } from '../budget.controller';
import { BudgetService } from '../budget.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId], role: 'FOUNDER' },
  };
}

describe('BudgetController', () => {
  let controller: BudgetController;
  let service: jest.Mocked<BudgetService>;

  beforeEach(async () => {
    service = {
      getCurrentBudget: jest.fn(),
      saveNewVersion: jest.fn(),
      listVersions: jest.fn(),
      compareVersions: jest.fn(),
      restoreVersion: jest.fn(),
      unlockBudget: jest.fn(),
    } as unknown as jest.Mocked<BudgetService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [
        { provide: BudgetService, useValue: service },
        {
          provide: AuditTrailInterceptor,
          useValue: { intercept: jest.fn((_ctx, next) => next.handle()) },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BudgetController>(BudgetController);
  });

  it('should return the current budget', async () => {
    service.getCurrentBudget.mockResolvedValue({
      projectId: 'proj-1',
      items: [],
    } as never);

    const result = await controller.getCurrentBudget('proj-1');

    expect(service.getCurrentBudget).toHaveBeenCalledWith('proj-1');
    expect(result.projectId).toBe('proj-1');
  });

  it('should save a new budget version', async () => {
    service.saveNewVersion.mockResolvedValue({
      id: 'ver-1',
      versionNumber: 2,
    } as never);

    const result = await controller.saveVersion(
      mockRequest() as never,
      'proj-1',
    );

    expect(service.saveNewVersion).toHaveBeenCalledWith('proj-1', 'u-1');
    expect(result.id).toBe('ver-1');
  });

  it('should list budget versions', async () => {
    service.listVersions.mockResolvedValue([
      { id: 'ver-1', versionNumber: 1 },
    ] as never);

    const result = await controller.listVersions('proj-1');

    expect(service.listVersions).toHaveBeenCalledWith('proj-1');
    expect(result).toHaveLength(1);
  });

  it('should compare two budget versions', async () => {
    service.compareVersions.mockResolvedValue({
      added: [],
      removed: [],
      changed: [],
      gpDelta: 0,
    } as never);

    const result = await controller.compareVersions('proj-1', 'v1', 'v2');

    expect(service.compareVersions).toHaveBeenCalledWith('proj-1', 'v1', 'v2');
    expect(result.gpDelta).toBe(0);
  });

  it('should restore a budget version', async () => {
    service.restoreVersion.mockResolvedValue({
      id: 'ver-3',
      versionNumber: 3,
    } as never);

    const result = await controller.restoreVersion(
      mockRequest() as never,
      'proj-1',
      'ver-1',
    );

    expect(service.restoreVersion).toHaveBeenCalledWith(
      'proj-1',
      'ver-1',
      'u-1',
    );
    expect(result.id).toBe('ver-3');
  });

  it('should unlock a budget', async () => {
    service.unlockBudget.mockResolvedValue({
      id: 'budget-1',
      lockedAt: null,
    } as never);

    const result = await controller.unlockBudget(
      mockRequest() as never,
      'budget-1',
    );

    expect(service.unlockBudget).toHaveBeenCalledWith(
      'budget-1',
      'u-1',
      'org-1',
    );
    expect(result.lockedAt).toBeNull();
  });

  describe('AuditTrailInterceptor wiring (PRJ-022)', () => {
    it('should declare AuditTrailInterceptor at controller class level', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        BudgetController,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });
  });
});
