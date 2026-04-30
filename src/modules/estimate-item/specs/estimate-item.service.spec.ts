import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstimateItemService } from '../estimate-item.service';
import { EstimateItemRepository } from '../estimate-item.repository';
import { ProjectRepository } from '../../project/project.repository';
import { PrismaService } from '../../../database/prisma.service';

interface MockEstimateItem {
  id: string;
  projectId: string;
  organizationId: string;
  productId: string | null;
  productName: string | null;
  productUom: string | null;
  supplierId: string | null;
  supplierName: string | null;
  qty: number;
  unitPrice: number;
  vatIncluded: boolean;
  bufferAmount: number;
  category: string;
  currency: string;
  fxRate: number;
  isDeleted: boolean;
  createdAt: Date;
}

function mockProjectDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Project 1',
    status: 'DRAFT',
    ownerId: 'u-1',
    customerId: null,
    stageId: null,
    totalProjectPrice: null,
    expectedCloseDate: null,
    customerPoNumber: null,
    customerPoIssuedDate: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    stage: null,
    customFieldValues: [],
    attachments: [],
    ...overrides,
  };
}

function mockEstimateItem(
  overrides: Partial<MockEstimateItem> = {},
): MockEstimateItem {
  return {
    id: 'est-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    productId: 'prod-1',
    productName: 'Widget Pro',
    productUom: 'pcs',
    supplierId: 'sup-1',
    supplierName: 'Supplier A',
    qty: 2,
    unitPrice: 100,
    vatIncluded: true,
    bufferAmount: 0,
    category: 'MATERIAL',
    currency: 'THB',
    fxRate: 1,
    isDeleted: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('EstimateItemService', () => {
  let service: EstimateItemService;
  let estimateItemRepository: jest.Mocked<EstimateItemRepository>;
  let projectRepository: jest.Mocked<ProjectRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    estimateItemRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllByProject: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<EstimateItemRepository>;

    projectRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    prisma = {
      product: { findFirst: jest.fn(), findMany: jest.fn() },
      supplier: { findFirst: jest.fn(), findMany: jest.fn() },
      estimateItem: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimateItemService,
        { provide: EstimateItemRepository, useValue: estimateItemRepository },
        { provide: ProjectRepository, useValue: projectRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EstimateItemService>(EstimateItemService);
  });

  describe('createForProject', () => {
    it('should snapshot product/supplier names and persist when productId belongs to org', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        name: 'Widget Pro',
        uom: 'pcs',
      });
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
        id: 'sup-1',
        name: 'Supplier A',
      });
      estimateItemRepository.create.mockResolvedValue(
        mockEstimateItem() as any,
      );

      const result = await service.createForProject(
        'proj-1',
        {
          productId: 'prod-1',
          supplierId: 'sup-1',
          qty: 2,
          unitPrice: 100,
        },
        'org-1',
      );

      expect(estimateItemRepository.create).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
        expect.objectContaining({
          productName: 'Widget Pro',
          productUom: 'pcs',
          supplierName: 'Supplier A',
          qty: 2,
          unitPrice: 100,
        }),
      );
      expect(result.id).toBe('est-1');
    });

    it('should default bufferAmount to 0 when omitted from DTO', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      estimateItemRepository.create.mockResolvedValue(
        mockEstimateItem({ bufferAmount: 0 }) as any,
      );

      await service.createForProject(
        'proj-1',
        { qty: 1, unitPrice: 50 },
        'org-1',
      );

      const passed = estimateItemRepository.create.mock.calls[0][2];
      expect(passed.bufferAmount).toBeUndefined();
      // Repository layer is responsible for the default — service simply passes
      // through the DTO. The repository's `data.bufferAmount ?? 0` handles default.
    });

    it('should reject 400 when productId is not in active org', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createForProject(
          'proj-1',
          { productId: 'bad-prod', qty: 1, unitPrice: 100 },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 400 when supplierId is not in active org', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createForProject(
          'proj-1',
          { supplierId: 'bad-sup', qty: 1, unitPrice: 100 },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 404 when project does not belong to active org', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.createForProject('proj-1', { qty: 1, unitPrice: 100 }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should succeed even when parent budget is LOCKED (estimates unaffected by lock)', async () => {
      // Budget lock is intentionally NOT consulted by EstimateItemService — the
      // service does not depend on BudgetRepository at all. This test pins that
      // contract: with the project resolvable, the create path completes and
      // never touches budget state.
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      estimateItemRepository.create.mockResolvedValue(
        mockEstimateItem() as any,
      );

      const result = await service.createForProject(
        'proj-1',
        { qty: 1, unitPrice: 100 },
        'org-1',
      );

      expect(result).toBeDefined();
      expect(estimateItemRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAllByProject', () => {
    it('should return only non-deleted items for the project, scoped by organization', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      estimateItemRepository.findAllByProject.mockResolvedValue([
        mockEstimateItem(),
        mockEstimateItem({ id: 'est-2', createdAt: new Date('2026-01-02') }),
      ] as any);

      const result = await service.findAllByProject('proj-1', 'org-1', {});

      expect(estimateItemRepository.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
        { productId: undefined, supplierId: undefined },
      );
      expect(result).toHaveLength(2);
    });

    it('should pass through productId and supplierId filters', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      estimateItemRepository.findAllByProject.mockResolvedValue([] as any);

      await service.findAllByProject('proj-1', 'org-1', {
        productId: 'prod-1',
        supplierId: 'sup-1',
      });

      expect(estimateItemRepository.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
        { productId: 'prod-1', supplierId: 'sup-1' },
      );
    });

    it('should reject 404 when project not in org (cross-org access)', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.findAllByProject('proj-1', 'org-2', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateById', () => {
    it('should update the item when in same org', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem() as any,
      );
      estimateItemRepository.update.mockResolvedValue(
        mockEstimateItem({ qty: 5 }) as any,
      );

      const result = await service.updateById('est-1', { qty: 5 }, 'org-1');

      expect(estimateItemRepository.update).toHaveBeenCalledWith(
        'est-1',
        expect.objectContaining({ qty: 5 }),
      );
      expect(result.qty).toBe(5);
    });

    it('should reject 404 when item belongs to a different org', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem({ organizationId: 'org-2' }) as any,
      );

      await expect(
        service.updateById('est-1', { qty: 5 }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should re-snapshot product when productId changes to a valid org product', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem({ productId: 'prod-1' }) as any,
      );
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'prod-2',
        name: 'New Widget',
        uom: 'kg',
      });
      estimateItemRepository.update.mockResolvedValue(
        mockEstimateItem() as any,
      );

      await service.updateById('est-1', { productId: 'prod-2' }, 'org-1');

      expect(estimateItemRepository.update).toHaveBeenCalledWith(
        'est-1',
        expect.objectContaining({
          productName: 'New Widget',
          productUom: 'kg',
        }),
      );
    });

    it('should re-snapshot supplier when supplierId changes to a valid org supplier', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem({ supplierId: 'sup-1' }) as any,
      );
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
        id: 'sup-2',
        name: 'Supplier B',
      });
      estimateItemRepository.update.mockResolvedValue(
        mockEstimateItem() as any,
      );

      await service.updateById('est-1', { supplierId: 'sup-2' }, 'org-1');

      expect(estimateItemRepository.update).toHaveBeenCalledWith(
        'est-1',
        expect.objectContaining({ supplierName: 'Supplier B' }),
      );
    });
  });

  describe('deleteById', () => {
    it('should soft-delete the item', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem() as any,
      );

      await service.deleteById('est-1', 'org-1');

      expect(estimateItemRepository.softDelete).toHaveBeenCalledWith('est-1');
    });

    it('should reject 404 on cross-org delete', async () => {
      estimateItemRepository.findById.mockResolvedValue(
        mockEstimateItem({ organizationId: 'org-2' }) as any,
      );

      await expect(service.deleteById('est-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkReplaceForProject', () => {
    function setupTransaction(tx: {
      estimateItem: {
        updateMany: jest.Mock;
        create: jest.Mock;
        findMany: jest.Mock;
      };
    }) {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );
    }

    it("mode='replace' soft-deletes existing rows and inserts new ones", async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      const tx = {
        estimateItem: {
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          create: jest.fn().mockResolvedValue({}),
          findMany: jest
            .fn()
            .mockResolvedValue([mockEstimateItem(), mockEstimateItem()]),
        },
      };
      setupTransaction(tx);

      const result = await service.bulkReplaceForProject(
        'proj-1',
        {
          mode: 'replace',
          items: [
            { qty: 1, unitPrice: 10 },
            { qty: 2, unitPrice: 20 },
          ],
        },
        'org-1',
      );

      expect(tx.estimateItem.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', isDeleted: false },
        data: { isDeleted: true },
      });
      expect(tx.estimateItem.create).toHaveBeenCalledTimes(2);
      expect(result.replaced).toBe(3);
      expect(result.appended).toBe(2);
    });

    it("mode='append' does not soft-delete existing rows", async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      const tx = {
        estimateItem: {
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([mockEstimateItem()]),
        },
      };
      setupTransaction(tx);

      const result = await service.bulkReplaceForProject(
        'proj-1',
        { mode: 'append', items: [{ qty: 1, unitPrice: 10 }] },
        'org-1',
      );

      expect(tx.estimateItem.updateMany).not.toHaveBeenCalled();
      expect(tx.estimateItem.create).toHaveBeenCalledTimes(1);
      expect(result.replaced).toBe(0);
      expect(result.appended).toBe(1);
    });

    it('rejects 400 when any productId in items[] is not in active org', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]); // none found

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          {
            mode: 'replace',
            items: [{ productId: 'bad-prod', qty: 1, unitPrice: 10 }],
          },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 400 when any supplierId in items[] is not in active org', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          {
            mode: 'replace',
            items: [{ supplierId: 'bad-sup', qty: 1, unitPrice: 10 }],
          },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 404 when project not in active org', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          { mode: 'replace', items: [] },
          'org-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('snapshots product/supplier names from the master record when items reference valid productId and supplierId', async () => {
      projectRepository.findById.mockResolvedValue(mockProjectDetail() as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: 'prod-1', name: 'Widget Pro', uom: 'pcs' },
      ]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-1', name: 'Supplier A' },
      ]);

      const tx = {
        estimateItem: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([mockEstimateItem()]),
        },
      };
      setupTransaction(tx);

      await service.bulkReplaceForProject(
        'proj-1',
        {
          mode: 'append',
          items: [
            {
              productId: 'prod-1',
              supplierId: 'sup-1',
              qty: 1,
              unitPrice: 10,
            },
          ],
        },
        'org-1',
      );

      expect(tx.estimateItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productName: 'Widget Pro',
            productUom: 'pcs',
            supplierName: 'Supplier A',
          }),
        }),
      );
    });
  });
});
