import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EstimateItemController } from '../estimate-item.controller';
import { EstimateItemService } from '../estimate-item.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
  };
}

function mockEstimateItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'est-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    productId: null,
    productName: null,
    productUom: null,
    supplierId: null,
    supplierName: null,
    qty: 1,
    unitPrice: 100,
    vatIncluded: true,
    bufferAmount: 0,
    category: 'MATERIAL',
    currency: 'THB',
    fxRate: 1,
    isDeleted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('EstimateItemController', () => {
  let controller: EstimateItemController;
  let service: jest.Mocked<EstimateItemService>;

  beforeEach(async () => {
    service = {
      createForProject: jest.fn(),
      findAllByProject: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
      bulkReplaceForProject: jest.fn(),
    } as unknown as jest.Mocked<EstimateItemService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstimateItemController],
      providers: [
        { provide: EstimateItemService, useValue: service },
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

    controller = module.get<EstimateItemController>(EstimateItemController);
  });

  describe('create (POST projects/:projectId/estimate-items)', () => {
    it('returns the created item', async () => {
      service.createForProject.mockResolvedValue(mockEstimateItem() as any);

      const result = await controller.create(mockRequest() as any, 'proj-1', {
        qty: 1,
        unitPrice: 100,
      });

      expect(service.createForProject).toHaveBeenCalledWith(
        'proj-1',
        { qty: 1, unitPrice: 100 },
        'org-1',
      );
      expect(result.id).toBe('est-1');
    });

    it('propagates 404 when project unknown', async () => {
      service.createForProject.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.create(mockRequest() as any, 'unknown', {
          qty: 1,
          unitPrice: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll (GET projects/:projectId/estimate-items)', () => {
    it('returns the project items', async () => {
      service.findAllByProject.mockResolvedValue([mockEstimateItem()] as any);

      const result = await controller.findAll(
        mockRequest() as any,
        'proj-1',
        {},
      );

      expect(result).toHaveLength(1);
    });

    it('propagates 404 when project unknown', async () => {
      service.findAllByProject.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.findAll(mockRequest() as any, 'unknown', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (PATCH estimate-items/:itemId)', () => {
    it('returns the updated item', async () => {
      service.updateById.mockResolvedValue(mockEstimateItem({ qty: 5 }) as any);

      const result = await controller.update(mockRequest() as any, 'est-1', {
        qty: 5,
      });

      expect(service.updateById).toHaveBeenCalledWith(
        'est-1',
        { qty: 5 },
        'org-1',
      );
      expect(result.qty).toBe(5);
    });
  });

  describe('delete (DELETE estimate-items/:itemId)', () => {
    it('calls service with itemId and orgId', async () => {
      service.deleteById.mockResolvedValue(undefined);

      await controller.delete(mockRequest() as any, 'est-1');

      expect(service.deleteById).toHaveBeenCalledWith('est-1', 'org-1');
    });
  });

  describe('bulkReplace (POST projects/:projectId/estimate-items/bulk-replace)', () => {
    it('returns replaced/appended/items summary', async () => {
      service.bulkReplaceForProject.mockResolvedValue({
        replaced: 0,
        appended: 1,
        items: [mockEstimateItem()],
      } as any);

      const result = await controller.bulkReplace(
        mockRequest() as any,
        'proj-1',
        { mode: 'append', items: [{ qty: 1, unitPrice: 10 }] },
      );

      expect(service.bulkReplaceForProject).toHaveBeenCalledWith(
        'proj-1',
        { mode: 'append', items: [{ qty: 1, unitPrice: 10 }] },
        'org-1',
      );
      expect(result.appended).toBe(1);
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
  });
});
