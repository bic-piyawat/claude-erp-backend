import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import { SupplierService } from '../supplier.service';
import { SupplierRepository } from '../supplier.repository';

function mockSupplier(overrides = {}) {
  return {
    id: 'sup-1',
    name: 'Supplier A',
    type: SupplierType.COMPANY,
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

    it('should pass through type filter to the repository', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockSupplier()],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20,
      });

      await service.findAll('org-1', undefined, 1, 20, SupplierType.COMPANY);

      expect(repository.findAll).toHaveBeenCalledWith(
        'org-1',
        undefined,
        1,
        20,
        SupplierType.COMPANY,
      );
    });

    it('should pass through INDIVIDUAL type filter', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockSupplier({ type: SupplierType.INDIVIDUAL })],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20,
      });

      await service.findAll('org-1', undefined, 1, 20, SupplierType.INDIVIDUAL);

      expect(repository.findAll).toHaveBeenCalledWith(
        'org-1',
        undefined,
        1,
        20,
        SupplierType.INDIVIDUAL,
      );
    });

    it('should not filter by type when type is undefined', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockSupplier(), mockSupplier({ type: SupplierType.INDIVIDUAL })],
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20,
      });

      await service.findAll('org-1', undefined, 1, 20);

      expect(repository.findAll).toHaveBeenCalledWith(
        'org-1',
        undefined,
        1,
        20,
        undefined,
      );
    });
  });

  describe('findById', () => {
    it('should return a supplier when found', async () => {
      repository.findById.mockResolvedValue(mockSupplier());

      const result = await service.findById('sup-1', 'org-1');

      expect(result.id).toBe('sup-1');
    });

    it('should return the supplier type', async () => {
      repository.findById.mockResolvedValue(
        mockSupplier({ type: SupplierType.INDIVIDUAL }),
      );

      const result = await service.findById('sup-1', 'org-1');

      expect(result.type).toBe(SupplierType.INDIVIDUAL);
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

    it('should default type to COMPANY when type is not supplied', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockSupplier());

      await service.create('org-1', { name: 'Supplier A' });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: SupplierType.COMPANY }),
      );
    });

    it('should persist type=INDIVIDUAL when supplied', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(
        mockSupplier({ type: SupplierType.INDIVIDUAL }),
      );

      const result = await service.create('org-1', {
        name: 'Freelancer X',
        type: SupplierType.INDIVIDUAL,
      });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: SupplierType.INDIVIDUAL }),
      );
      expect(result.type).toBe(SupplierType.INDIVIDUAL);
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

    it('should reject 422 BUSINESS_RULE_VIOLATION when type is in update body', async () => {
      repository.findById.mockResolvedValue(mockSupplier());

      await expect(
        service.update('sup-1', 'org-1', {
          type: SupplierType.INDIVIDUAL,
        }),
      ).rejects.toThrow(HttpException);
      expect(repository.update).not.toHaveBeenCalled();
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
