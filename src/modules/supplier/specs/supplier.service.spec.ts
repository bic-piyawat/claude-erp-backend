import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupplierService } from '../supplier.service';
import { SupplierRepository } from '../supplier.repository';

function mockSupplier(overrides = {}) {
  return {
    id: 'sup-1',
    name: 'Supplier A',
    paymentTerms: 'Net 30',
    leadTimeDays: 7,
    phone: null,
    email: null,
    address: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<SupplierRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByNameAndOrg: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as jest.Mocked<SupplierRepository>;
}

describe('SupplierService', () => {
  let service: SupplierService;
  let repository: jest.Mocked<SupplierRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: SupplierRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockSupplier()],
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
    it('should return a supplier when found', async () => {
      repository.findById.mockResolvedValue(mockSupplier());

      const result = await service.findById('sup-1', 'org-1');

      expect(result.id).toBe('sup-1');
    });

    it('should throw NotFoundException when supplier not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a supplier when name is unique', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockSupplier());

      const result = await service.create('org-1', { name: 'Supplier A' });

      expect(result.name).toBe('Supplier A');
    });

    it('should throw ConflictException when name already exists', async () => {
      repository.findByNameAndOrg.mockResolvedValue(mockSupplier());

      await expect(
        service.create('org-1', { name: 'Supplier A' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      repository.findById.mockResolvedValue(mockSupplier());
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.update.mockResolvedValue(
        mockSupplier({ name: 'Updated Supplier' }),
      );

      const result = await service.update('sup-1', 'org-1', {
        name: 'Updated Supplier',
      });

      expect(result.name).toBe('Updated Supplier');
    });

    it('should throw NotFoundException when supplier not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', 'org-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a supplier', async () => {
      repository.findById.mockResolvedValue(mockSupplier());

      await service.delete('sup-1', 'org-1');

      expect(repository.softDelete).toHaveBeenCalledWith('sup-1');
    });

    it('should throw NotFoundException when supplier not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
