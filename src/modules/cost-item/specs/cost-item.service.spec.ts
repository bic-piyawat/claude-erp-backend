import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CostItemService } from '../cost-item.service';
import { CostItemRepository } from '../cost-item.repository';
import { BudgetRepository } from '../../budget/budget.repository';
import { BudgetService } from '../../budget/budget.service';
import { ProjectRepository } from '../../project/project.repository';
import { ProfitabilityService } from '../../project/profitability.service';
import { PrismaService } from '../../../database/prisma.service';

function mockBudget(status: 'DRAFT' | 'LOCKED' = 'DRAFT') {
  return {
    id: 'budget-1',
    projectId: 'proj-1',
    version: 1,
    status,
    vatRate: 7,
    lockedAt: null,
    createdBy: 'u-1',
    createdAt: new Date(),
  };
}

function mockBudgetWithItems(
  status: 'DRAFT' | 'LOCKED' = 'DRAFT',
  costItems: Record<string, unknown>[] = [],
) {
  return { ...mockBudget(status), costItems };
}

function mockCostItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    budgetId: 'budget-1',
    productId: 'prod-1',
    productName: 'Widget Pro',
    productUom: 'pcs',
    productStandardCost: 100,
    supplierId: 'sup-1',
    supplierName: 'Supplier A',
    qty: 2,
    unitPrice: 100,
    vatIncluded: true,
    category: 'MATERIAL',
    currency: 'THB',
    fxRate: 1,
    landedCost: 0,
    status: 'QUOTED',
    paymentTerms: 'Net 30',
    leadTime: 7,
    lineTotal: 200,
    isDeleted: false,
    ...overrides,
  };
}

function mockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Project 1',
    status: 'DRAFT',
    ownerId: 'u-1',
    customerId: null,
    stageId: null,
    totalProjectPrice: 1000,
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

describe('CostItemService', () => {
  let service: CostItemService;
  let costItemRepository: jest.Mocked<CostItemRepository>;
  let budgetRepository: jest.Mocked<BudgetRepository>;
  let budgetService: jest.Mocked<BudgetService>;
  let projectRepository: jest.Mocked<ProjectRepository>;
  let profitabilityService: jest.Mocked<ProfitabilityService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    costItemRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllByBudget: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<CostItemRepository>;

    budgetRepository = {
      findById: jest.fn(),
      findCurrentByProject: jest.fn(),
    } as unknown as jest.Mocked<BudgetRepository>;

    budgetService = {
      assertNotLocked: jest.fn(),
    } as unknown as jest.Mocked<BudgetService>;

    projectRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    profitabilityService = {
      compute: jest.fn().mockReturnValue({
        totalRevenueNet: 0,
        totalCostNet: 0,
        grossProfit: 0,
        grossMargin: 0,
        colorBand: 'RED',
      }),
    } as unknown as jest.Mocked<ProfitabilityService>;

    prisma = {
      product: { findFirst: jest.fn(), findMany: jest.fn() },
      supplier: { findFirst: jest.fn(), findMany: jest.fn() },
      costItem: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostItemService,
        { provide: CostItemRepository, useValue: costItemRepository },
        { provide: BudgetRepository, useValue: budgetRepository },
        { provide: BudgetService, useValue: budgetService },
        { provide: ProjectRepository, useValue: projectRepository },
        { provide: ProfitabilityService, useValue: profitabilityService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CostItemService>(CostItemService);
  });

  describe('computeLineTotal', () => {
    it('should compute lineTotal as qty × unitPrice', () => {
      const result = service.computeLineTotal(2, 100);

      expect(result).toBe(200);
    });
  });

  describe('create', () => {
    it('should create a cost item with snapshot values and computed lineTotal', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        name: 'Widget Pro',
        uom: 'pcs',
        standardCost: 100,
      });
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
        name: 'Supplier A',
      });
      costItemRepository.create.mockResolvedValue(mockCostItem() as any);

      const result = await service.create(
        'budget-1',
        {
          productId: 'prod-1',
          supplierId: 'sup-1',
          qty: 2,
          unitPrice: 100,
        },
        'org-1',
      );

      expect(costItemRepository.create).toHaveBeenCalledWith(
        'budget-1',
        expect.objectContaining({
          lineTotal: 200,
          productName: 'Widget Pro',
          supplierName: 'Supplier A',
        }),
      );
      expect(result.lineTotal).toBe(200);
    });

    it('should throw ForbiddenException when budget is LOCKED', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget('LOCKED') as any);

      await expect(
        service.create('budget-1', { qty: 1, unitPrice: 100 }, 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when productId does not belong to org', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          'budget-1',
          { productId: 'bad-prod', qty: 1, unitPrice: 100 },
          'org-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when supplierId does not belong to org', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          'budget-1',
          { supplierId: 'bad-sup', qty: 1, unitPrice: 100 },
          'org-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when budget not found', async () => {
      budgetRepository.findById.mockResolvedValue(null);

      await expect(
        service.create('missing', { qty: 1, unitPrice: 1 }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not change snapshot values when Product master data changes later', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        name: 'Original Name',
        uom: 'kg',
        standardCost: 50,
      });
      (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({
        name: 'Supplier A',
      });
      costItemRepository.create.mockResolvedValue(
        mockCostItem({ productName: 'Original Name' }) as any,
      );

      await service.create(
        'budget-1',
        { productId: 'prod-1', qty: 1, unitPrice: 50 },
        'org-1',
      );

      const createCall = costItemRepository.create.mock.calls[0][1];
      expect(createCall.productName).toBe('Original Name');
    });
  });

  describe('update', () => {
    it('should recompute lineTotal when qty or unitPrice changes', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      costItemRepository.update.mockResolvedValue(
        mockCostItem({ qty: 3, unitPrice: 100, lineTotal: 300 }) as any,
      );

      await service.update('budget-1', 'item-1', { qty: 3 });

      expect(costItemRepository.update).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({ lineTotal: 300 }),
      );
    });

    it('should throw ForbiddenException when budget is LOCKED', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget('LOCKED') as any);

      await expect(service.update('budget-1', 'item-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when budget not found', async () => {
      budgetRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('missing', 'item-1', { qty: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item not in budget', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      costItemRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('budget-1', 'missing', { qty: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a cost item', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);

      await service.delete('budget-1', 'item-1');

      expect(costItemRepository.softDelete).toHaveBeenCalledWith('item-1');
    });

    it('should throw ForbiddenException when budget is LOCKED', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget('LOCKED') as any);

      await expect(service.delete('budget-1', 'item-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when budget not found', async () => {
      budgetRepository.findById.mockResolvedValue(null);

      await expect(service.delete('missing', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item not in budget', async () => {
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      costItemRepository.findById.mockResolvedValue(null);

      await expect(service.delete('budget-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createForProject', () => {
    it('should resolve current Budget and delegate to single-row create', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('DRAFT') as any,
      );
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      costItemRepository.create.mockResolvedValue(mockCostItem() as any);

      const result = await service.createForProject(
        'proj-1',
        { qty: 2, unitPrice: 100 },
        'org-1',
      );

      expect(budgetRepository.findCurrentByProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(costItemRepository.create).toHaveBeenCalledWith(
        'budget-1',
        expect.objectContaining({ lineTotal: 200 }),
      );
      expect(result).toBeDefined();
    });

    it('should reject 404 when project not in active org', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.createForProject('proj-1', { qty: 1, unitPrice: 1 }, 'org-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject 404 when project has no budget', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      await expect(
        service.createForProject('proj-1', { qty: 1, unitPrice: 1 }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject ForbiddenException when current budget is LOCKED', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('LOCKED') as any,
      );
      budgetRepository.findById.mockResolvedValue(mockBudget('LOCKED') as any);

      await expect(
        service.createForProject('proj-1', { qty: 1, unitPrice: 1 }, 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByProject', () => {
    it("returns the current budget's cost items", async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('DRAFT') as any,
      );
      const items = [mockCostItem(), mockCostItem({ id: 'item-2' })];
      costItemRepository.findAllByBudget.mockResolvedValue(items as any);

      const result = await service.findAllByProject('proj-1', 'org-1');

      expect(projectRepository.findById).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
      );
      expect(budgetRepository.findCurrentByProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(costItemRepository.findAllByBudget).toHaveBeenCalledWith(
        'budget-1',
      );
      expect(result).toEqual(items);
    });

    it('returns an empty array when project has no current budget', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      const result = await service.findAllByProject('proj-1', 'org-1');

      expect(result).toEqual([]);
      expect(costItemRepository.findAllByBudget).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when project not in active org', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.findAllByProject('proj-1', 'org-2')).rejects.toThrow(
        NotFoundException,
      );

      expect(budgetRepository.findCurrentByProject).not.toHaveBeenCalled();
      expect(costItemRepository.findAllByBudget).not.toHaveBeenCalled();
    });

    it('relies on the repository to filter out soft-deleted items', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('DRAFT') as any,
      );
      // Repo only returns non-deleted rows; service passes them through unchanged.
      const activeOnly = [mockCostItem({ id: 'item-active' })];
      costItemRepository.findAllByBudget.mockResolvedValue(activeOnly as any);

      const result = await service.findAllByProject('proj-1', 'org-1');

      expect(result).toEqual(activeOnly);
      expect(result.every((i) => i.isDeleted === false)).toBe(true);
    });

    it('returns items even when the current budget is LOCKED (read-only)', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('LOCKED') as any,
      );
      const items = [mockCostItem()];
      costItemRepository.findAllByBudget.mockResolvedValue(items as any);

      const result = await service.findAllByProject('proj-1', 'org-1');

      expect(result).toEqual(items);
      expect(budgetService.assertNotLocked).not.toHaveBeenCalled();
    });
  });

  describe('updateById', () => {
    it('should resolve project from item and delegate to single-row update', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      costItemRepository.update.mockResolvedValue(
        mockCostItem({ qty: 5 }) as any,
      );

      const result = await service.updateById('item-1', { qty: 5 }, 'org-1');

      expect(costItemRepository.update).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({ lineTotal: 500 }),
      );
      expect(result).toBeDefined();
    });

    it('should reject 404 when item not found', async () => {
      costItemRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateById('missing', { qty: 1 }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject 404 on cross-org access (item in other org)', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      projectRepository.findById.mockResolvedValue(null); // org-B query → not found

      await expect(
        service.updateById('item-1', { qty: 5 }, 'org-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject ForbiddenException when budget is LOCKED', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById
        .mockResolvedValueOnce(mockBudget() as any) // loadItemForOrg
        .mockResolvedValueOnce(mockBudget('LOCKED') as any); // delegated update
      projectRepository.findById.mockResolvedValue(mockProject() as any);

      await expect(
        service.updateById('item-1', { qty: 5 }, 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteById', () => {
    it('should resolve project from item and soft-delete', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      projectRepository.findById.mockResolvedValue(mockProject() as any);

      await service.deleteById('item-1', 'org-1');

      expect(costItemRepository.softDelete).toHaveBeenCalledWith('item-1');
    });

    it('should reject 404 on cross-org access', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById.mockResolvedValue(mockBudget() as any);
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.deleteById('item-1', 'org-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject ForbiddenException when budget is LOCKED', async () => {
      costItemRepository.findById.mockResolvedValue(mockCostItem() as any);
      budgetRepository.findById
        .mockResolvedValueOnce(mockBudget() as any) // loadItemForOrg
        .mockResolvedValueOnce(mockBudget('LOCKED') as any); // delegated delete
      projectRepository.findById.mockResolvedValue(mockProject() as any);

      await expect(service.deleteById('item-1', 'org-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('bulkReplaceForProject', () => {
    function setupTransaction(tx: {
      costItem: {
        findMany: jest.Mock;
        updateMany: jest.Mock;
        create: jest.Mock;
      };
      auditLog: { create: jest.Mock };
    }) {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );
    }

    it("mode='replace' soft-deletes existing rows and inserts new ones", async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any) // pre
        .mockResolvedValueOnce(
          mockBudgetWithItems('DRAFT', [
            { lineTotal: 10, vatIncluded: true },
            { lineTotal: 20, vatIncluded: true },
          ]) as any,
        ); // post
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      const tx = {
        costItem: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'old-1' },
              { id: 'old-2' },
              { id: 'old-3' },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          create: jest.fn().mockResolvedValue({ id: 'new-x' }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
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
        'u-1',
      );

      expect(budgetService.assertNotLocked).toHaveBeenCalledWith('budget-1');
      expect(tx.costItem.updateMany).toHaveBeenCalledWith({
        where: { budgetId: 'budget-1', isDeleted: false },
        data: { isDeleted: true },
      });
      expect(tx.costItem.create).toHaveBeenCalledTimes(2);
      expect(result.replaced).toBe(3);
      expect(result.appended).toBe(2);
      expect(profitabilityService.compute).toHaveBeenCalled();
    });

    it("mode='append' does not soft-delete existing rows", async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any)
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any);
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      const tx = {
        costItem: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'new-x' }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      setupTransaction(tx);

      const result = await service.bulkReplaceForProject(
        'proj-1',
        { mode: 'append', items: [{ qty: 1, unitPrice: 10 }] },
        'org-1',
        'u-1',
      );

      expect(tx.costItem.updateMany).not.toHaveBeenCalled();
      expect(tx.costItem.create).toHaveBeenCalledTimes(1);
      expect(result.replaced).toBe(0);
      expect(result.appended).toBe(1);
    });

    it('rejects ForbiddenException when current Budget is LOCKED', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('LOCKED') as any,
      );
      budgetService.assertNotLocked.mockRejectedValue(
        new ForbiddenException('Budget is locked'),
      );

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          { mode: 'replace', items: [] },
          'org-1',
          'u-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects 400 when any productId is not in active org (no transaction starts)', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('DRAFT') as any,
      );
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]); // none found

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          {
            mode: 'replace',
            items: [{ productId: 'bad-prod', qty: 1, unitPrice: 10 }],
          },
          'org-1',
          'u-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects 400 when any supplierId is not in active org (no transaction starts)', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudgetWithItems('DRAFT') as any,
      );
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]); // none found

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          {
            mode: 'replace',
            items: [{ supplierId: 'bad-sup', qty: 1, unitPrice: 10 }],
          },
          'org-1',
          'u-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("mode='replace' with empty items[] clears all existing rows", async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any)
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any);
      budgetService.assertNotLocked.mockResolvedValue(undefined);

      const tx = {
        costItem: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          create: jest.fn(),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      setupTransaction(tx);

      const result = await service.bulkReplaceForProject(
        'proj-1',
        { mode: 'replace', items: [] },
        'org-1',
        'u-1',
      );

      expect(tx.costItem.updateMany).toHaveBeenCalled();
      expect(tx.costItem.create).not.toHaveBeenCalled();
      expect(result.replaced).toBe(2);
      expect(result.appended).toBe(0);
    });

    it('recomputes profitability post-transaction with refreshed budget snapshot', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ totalProjectPrice: 5000 }) as any,
      );
      budgetRepository.findCurrentByProject
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any) // pre
        .mockResolvedValueOnce(
          mockBudgetWithItems('DRAFT', [
            { lineTotal: 100, vatIncluded: true },
          ]) as any,
        ); // post
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      const tx = {
        costItem: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'new-x' }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      setupTransaction(tx);

      await service.bulkReplaceForProject(
        'proj-1',
        { mode: 'append', items: [{ qty: 1, unitPrice: 100 }] },
        'org-1',
        'u-1',
      );

      expect(profitabilityService.compute).toHaveBeenCalledWith(5000, 7, [
        { lineTotal: 100, vatIncluded: true },
      ]);
    });

    it('rejects 404 when project not in active org', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          { mode: 'replace', items: [] },
          'org-2',
          'u-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('snapshots product/supplier names from master records when items reference valid productId and supplierId', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any)
        .mockResolvedValueOnce(mockBudgetWithItems('DRAFT') as any);
      budgetService.assertNotLocked.mockResolvedValue(undefined);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: 'prod-1', name: 'Widget Pro', uom: 'pcs', standardCost: 100 },
      ]);
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-1', name: 'Supplier A' },
      ]);

      const tx = {
        costItem: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'new-x' }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
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
        'u-1',
      );

      expect(tx.costItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productName: 'Widget Pro',
            productUom: 'pcs',
            productStandardCost: 100,
            supplierName: 'Supplier A',
          }),
        }),
      );
    });

    it('rejects 404 when project has no current budget', async () => {
      projectRepository.findById.mockResolvedValue(mockProject() as any);
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      await expect(
        service.bulkReplaceForProject(
          'proj-1',
          { mode: 'replace', items: [] },
          'org-1',
          'u-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
