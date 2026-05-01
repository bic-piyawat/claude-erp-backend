import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectCostItemController } from '../project-cost-item.controller';
import { CostItemService } from '../cost-item.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
  };
}

function mockCostItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    budgetId: 'budget-1',
    productId: null,
    productName: null,
    productUom: null,
    productStandardCost: null,
    supplierId: null,
    supplierName: null,
    qty: 1,
    unitPrice: 100,
    vatIncluded: true,
    category: 'MATERIAL',
    currency: 'THB',
    fxRate: 1,
    landedCost: 0,
    status: 'QUOTED',
    paymentTerms: null,
    leadTime: null,
    lineTotal: 100,
    isDeleted: false,
    ...overrides,
  };
}

describe('ProjectCostItemController', () => {
  let controller: ProjectCostItemController;
  let service: jest.Mocked<CostItemService>;

  beforeEach(async () => {
    service = {
      createForProject: jest.fn(),
      findAllByProject: jest.fn(),
      bulkReplaceForProject: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as jest.Mocked<CostItemService>;

    const mockPrisma = { auditLog: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectCostItemController],
      providers: [
        { provide: CostItemService, useValue: service },
        {
          provide: AuditTrailInterceptor,
          useValue: { intercept: jest.fn((_ctx, next) => next.handle()) },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectCostItemController>(
      ProjectCostItemController,
    );
  });

  describe('create (POST projects/:projectId/cost-items)', () => {
    it('returns the created item', async () => {
      service.createForProject.mockResolvedValue(mockCostItem() as any);

      const result = await controller.create(mockRequest() as any, 'proj-1', {
        qty: 1,
        unitPrice: 100,
      });

      expect(service.createForProject).toHaveBeenCalledWith(
        'proj-1',
        { qty: 1, unitPrice: 100 },
        'org-1',
      );
      expect(result.id).toBe('item-1');
    });

    it('propagates 404 when project unknown', async () => {
      service.createForProject.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.create(mockRequest() as any, 'unknown', {
          qty: 1,
          unitPrice: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates 403 when budget LOCKED', async () => {
      service.createForProject.mockRejectedValue(
        new ForbiddenException('Budget is locked'),
      );

      await expect(
        controller.create(mockRequest() as any, 'proj-1', {
          qty: 1,
          unitPrice: 1,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByProject (GET projects/:projectId/cost-items)', () => {
    it('returns the array of cost items for the project (200)', async () => {
      const items = [mockCostItem(), mockCostItem({ id: 'item-2' })];
      service.findAllByProject.mockResolvedValue(items as any);

      const result = await controller.findAllByProject(
        mockRequest() as any,
        'proj-1',
      );

      expect(service.findAllByProject).toHaveBeenCalledWith('proj-1', 'org-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
    });

    it('returns an empty array when project has no current budget', async () => {
      service.findAllByProject.mockResolvedValue([] as any);

      const result = await controller.findAllByProject(
        mockRequest() as any,
        'proj-1',
      );

      expect(result).toEqual([]);
    });

    it('propagates 404 when project unknown', async () => {
      service.findAllByProject.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.findAllByProject(mockRequest() as any, 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkReplace (POST projects/:projectId/cost-items/bulk-replace)', () => {
    it('returns replaced/appended/profitability summary', async () => {
      service.bulkReplaceForProject.mockResolvedValue({
        replaced: 1,
        appended: 2,
        profitability: {
          totalRevenueNet: 0,
          totalCostNet: 0,
          grossProfit: 0,
          grossMargin: 0,
          colorBand: 'RED',
        },
      } as any);

      const result = await controller.bulkReplace(
        mockRequest() as any,
        'proj-1',
        {
          mode: 'replace',
          items: [
            { qty: 1, unitPrice: 10 },
            { qty: 2, unitPrice: 20 },
          ],
        },
      );

      expect(service.bulkReplaceForProject).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({ mode: 'replace' }),
        'org-1',
        'u-1',
      );
      expect(result.replaced).toBe(1);
      expect(result.appended).toBe(2);
    });

    it('propagates 404 when project unknown', async () => {
      service.bulkReplaceForProject.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.bulkReplace(mockRequest() as any, 'unknown', {
          mode: 'replace',
          items: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates 403 when budget LOCKED', async () => {
      service.bulkReplaceForProject.mockRejectedValue(
        new ForbiddenException('Budget is locked'),
      );

      await expect(
        controller.bulkReplace(mockRequest() as any, 'proj-1', {
          mode: 'replace',
          items: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update (PATCH cost-items/:itemId)', () => {
    it('returns the updated item', async () => {
      service.updateById.mockResolvedValue(mockCostItem({ qty: 5 }) as any);

      const result = await controller.update(mockRequest() as any, 'item-1', {
        qty: 5,
      });

      expect(service.updateById).toHaveBeenCalledWith(
        'item-1',
        { qty: 5 },
        'org-1',
      );
      expect(result.qty).toBe(5);
    });

    it('propagates 403 when budget LOCKED', async () => {
      service.updateById.mockRejectedValue(
        new ForbiddenException('Budget is locked'),
      );

      await expect(
        controller.update(mockRequest() as any, 'item-1', { qty: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete (DELETE cost-items/:itemId)', () => {
    it('calls service with itemId and orgId', async () => {
      service.deleteById.mockResolvedValue(undefined);

      await controller.delete(mockRequest() as any, 'item-1');

      expect(service.deleteById).toHaveBeenCalledWith('item-1', 'org-1');
    });

    it('propagates 403 when budget LOCKED', async () => {
      service.deleteById.mockRejectedValue(
        new ForbiddenException('Budget is locked'),
      );

      await expect(
        controller.delete(mockRequest() as any, 'item-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
