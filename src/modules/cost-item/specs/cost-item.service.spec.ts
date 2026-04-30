import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CostItemService } from '../cost-item.service';
import { CostItemRepository } from '../cost-item.repository';
import { BudgetRepository } from '../../budget/budget.repository';
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

function mockCostItem(overrides = {}) {
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

describe('CostItemService', () => {
  let service: CostItemService;
  let costItemRepository: jest.Mocked<CostItemRepository>;
  let budgetRepository: jest.Mocked<BudgetRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    costItemRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<CostItemRepository>;

    budgetRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<BudgetRepository>;

    prisma = {
      product: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostItemService,
        { provide: CostItemRepository, useValue: costItemRepository },
        { provide: BudgetRepository, useValue: budgetRepository },
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
  });
});
