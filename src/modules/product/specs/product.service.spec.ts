import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from '../product.service';
import { ProductRepository } from '../product.repository';

function mockProduct(overrides = {}) {
  return {
    id: 'prod-1',
    name: 'Widget Pro',
    uom: 'pcs',
    category: 'MATERIAL',
    standardCost: 100,
    lastPrice: 100,
    lastUpdatedDate: null,
    defaultSupplierId: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<ProductRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as jest.Mocked<ProductRepository>;
}

describe('ProductService', () => {
  let service: ProductService;
  let repository: jest.Mocked<ProductRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: ProductRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockProduct()],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20,
      });

      const result = await service.findAll('org-1', undefined, 1, 20);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a product when found', async () => {
      repository.findById.mockResolvedValue(mockProduct());

      const result = await service.findById('prod-1', 'org-1');

      expect(result.id).toBe('prod-1');
    });

    it('should throw NotFoundException when product not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      repository.create.mockResolvedValue(mockProduct());

      const result = await service.create('org-1', { name: 'Widget Pro' });

      expect(result.name).toBe('Widget Pro');
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      repository.findById.mockResolvedValue(mockProduct());
      repository.update.mockResolvedValue(
        mockProduct({ name: 'Updated Widget' }),
      );

      const result = await service.update('prod-1', 'org-1', {
        name: 'Updated Widget',
      });

      expect(result.name).toBe('Updated Widget');
    });

    it('should throw NotFoundException when product not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', 'org-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a product', async () => {
      repository.findById.mockResolvedValue(mockProduct());

      await service.delete('prod-1', 'org-1');

      expect(repository.softDelete).toHaveBeenCalledWith('prod-1');
    });

    it('should throw NotFoundException when product not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
