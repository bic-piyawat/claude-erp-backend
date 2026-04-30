import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { CustomerService } from '../customer.service';
import { CustomerRepository } from '../customer.repository';

function mockCustomer(overrides = {}) {
  return {
    id: 'cust-1',
    name: 'Acme Corp',
    type: CustomerType.COMPANY,
    taxId: null,
    phone: null,
    email: null,
    address: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<CustomerRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByNameAndOrg: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as jest.Mocked<CustomerRepository>;
}

describe('CustomerService', () => {
  let service: CustomerService;
  let repository: jest.Mocked<CustomerRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: CustomerRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  describe('findAll', () => {
    it('should return paginated customers', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockCustomer()],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20,
      });

      const result = await service.findAll('org-1', undefined, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a customer when found', async () => {
      repository.findById.mockResolvedValue(mockCustomer());

      const result = await service.findById('cust-1', 'org-1');

      expect(result.id).toBe('cust-1');
    });

    it('should return the customer type', async () => {
      repository.findById.mockResolvedValue(
        mockCustomer({ type: CustomerType.GOVERNMENT }),
      );

      const result = await service.findById('cust-1', 'org-1');

      expect(result.type).toBe(CustomerType.GOVERNMENT);
    });

    it('should throw NotFoundException when customer not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a customer when name is unique', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockCustomer());

      const result = await service.create('org-1', { name: 'Acme Corp' });

      expect(result.name).toBe('Acme Corp');
    });

    it('should default type to COMPANY when type is not supplied', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockCustomer());

      await service.create('org-1', { name: 'Acme Corp' });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: CustomerType.COMPANY }),
      );
    });

    it('should persist type=INDIVIDUAL when supplied', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(
        mockCustomer({ type: CustomerType.INDIVIDUAL }),
      );

      const result = await service.create('org-1', {
        name: 'Jane Doe',
        type: CustomerType.INDIVIDUAL,
      });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: CustomerType.INDIVIDUAL }),
      );
      expect(result.type).toBe(CustomerType.INDIVIDUAL);
    });

    it('should persist type=GOVERNMENT when supplied', async () => {
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.create.mockResolvedValue(
        mockCustomer({ type: CustomerType.GOVERNMENT }),
      );

      const result = await service.create('org-1', {
        name: 'Ministry X',
        type: CustomerType.GOVERNMENT,
      });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: CustomerType.GOVERNMENT }),
      );
      expect(result.type).toBe(CustomerType.GOVERNMENT);
    });

    it('should throw ConflictException when name already exists', async () => {
      repository.findByNameAndOrg.mockResolvedValue(mockCustomer());

      await expect(
        service.create('org-1', { name: 'Acme Corp' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a customer', async () => {
      repository.findById.mockResolvedValue(mockCustomer());
      repository.findByNameAndOrg.mockResolvedValue(null);
      repository.update.mockResolvedValue(mockCustomer({ name: 'Updated' }));

      const result = await service.update('cust-1', 'org-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when customer not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', 'org-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when new name already exists', async () => {
      repository.findById.mockResolvedValue(mockCustomer({ name: 'Old Name' }));
      repository.findByNameAndOrg.mockResolvedValue(
        mockCustomer({ name: 'New Name' }),
      );

      await expect(
        service.update('cust-1', 'org-1', { name: 'New Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject 422 BUSINESS_RULE_VIOLATION when type is in update body', async () => {
      repository.findById.mockResolvedValue(mockCustomer());

      await expect(
        service.update('cust-1', 'org-1', {
          type: CustomerType.INDIVIDUAL,
        }),
      ).rejects.toThrow(HttpException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a customer', async () => {
      repository.findById.mockResolvedValue(mockCustomer());

      await service.delete('cust-1', 'org-1');

      expect(repository.softDelete).toHaveBeenCalledWith('cust-1');
    });

    it('should throw NotFoundException when customer not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
