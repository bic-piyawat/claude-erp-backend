import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { EstimateItemRepository } from '../estimate-item.repository';
import { PrismaService } from '../../../database/prisma.service';

describe('EstimateItemRepository', () => {
  let repository: EstimateItemRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      estimateItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimateItemRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<EstimateItemRepository>(EstimateItemRepository);
  });

  describe('create', () => {
    it('passes all fields to prisma with bufferAmount as Prisma.Decimal default 0', async () => {
      (prisma.estimateItem.create as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.create('proj-1', 'org-1', {
        productId: 'prod-1',
        productName: 'Widget',
        productUom: 'pcs',
        supplierId: 'sup-1',
        supplierName: 'Supplier A',
        qty: 2,
        unitPrice: 100,
      });

      const call = (prisma.estimateItem.create as jest.Mock).mock.calls[0][0];
      expect(call.data.projectId).toBe('proj-1');
      expect(call.data.organizationId).toBe('org-1');
      expect(call.data.productId).toBe('prod-1');
      expect(call.data.supplierId).toBe('sup-1');
      expect(call.data.qty).toBe(2);
      expect(call.data.unitPrice).toBe(100);
      expect(call.data.vatIncluded).toBe(true);
      expect(call.data.bufferAmount).toBeInstanceOf(Prisma.Decimal);
      expect(Number(call.data.bufferAmount)).toBe(0);
      expect(call.data.category).toBe('MATERIAL');
      expect(call.data.currency).toBe('THB');
      expect(call.data.fxRate).toBe(1);
    });

    it('persists explicit bufferAmount, vatIncluded, category, currency, fxRate', async () => {
      (prisma.estimateItem.create as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.create('proj-1', 'org-1', {
        qty: 1,
        unitPrice: 50,
        vatIncluded: false,
        bufferAmount: 12.34,
        category: 'LABOR',
        currency: 'USD',
        fxRate: 35.5,
      });

      const call = (prisma.estimateItem.create as jest.Mock).mock.calls[0][0];
      expect(call.data.vatIncluded).toBe(false);
      expect(Number(call.data.bufferAmount)).toBe(12.34);
      expect(call.data.category).toBe('LABOR');
      expect(call.data.currency).toBe('USD');
      expect(call.data.fxRate).toBe(35.5);
    });
  });

  describe('findById', () => {
    it('queries by id with isDeleted=false', async () => {
      (prisma.estimateItem.findFirst as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.findById('est-1');

      expect(prisma.estimateItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'est-1', isDeleted: false },
      });
    });
  });

  describe('findAllByProject', () => {
    it('filters by projectId, organizationId, isDeleted=false, ordered by createdAt asc', async () => {
      (prisma.estimateItem.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findAllByProject('proj-1', 'org-1');

      expect(prisma.estimateItem.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          organizationId: 'org-1',
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('applies productId and supplierId filters when provided', async () => {
      (prisma.estimateItem.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findAllByProject('proj-1', 'org-1', {
        productId: 'prod-1',
        supplierId: 'sup-1',
      });

      expect(prisma.estimateItem.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          organizationId: 'org-1',
          isDeleted: false,
          productId: 'prod-1',
          supplierId: 'sup-1',
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('passes only defined fields and converts bufferAmount to Prisma.Decimal', async () => {
      (prisma.estimateItem.update as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.update('est-1', { qty: 5, bufferAmount: 7.5 });

      const call = (prisma.estimateItem.update as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'est-1' });
      expect(call.data.qty).toBe(5);
      expect(call.data.bufferAmount).toBeInstanceOf(Prisma.Decimal);
      expect(Number(call.data.bufferAmount)).toBe(7.5);
      // Untouched fields are undefined (Prisma will skip them).
      expect(call.data.category).toBeUndefined();
      expect(call.data.currency).toBeUndefined();
    });

    it('leaves bufferAmount undefined when not in patch', async () => {
      (prisma.estimateItem.update as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.update('est-1', { qty: 5 });

      const call = (prisma.estimateItem.update as jest.Mock).mock.calls[0][0];
      expect(call.data.bufferAmount).toBeUndefined();
    });
  });

  describe('softDelete', () => {
    it('sets isDeleted=true on the row', async () => {
      (prisma.estimateItem.update as jest.Mock).mockResolvedValue({
        id: 'est-1',
      });

      await repository.softDelete('est-1');

      expect(prisma.estimateItem.update).toHaveBeenCalledWith({
        where: { id: 'est-1' },
        data: { isDeleted: true },
      });
    });
  });
});
