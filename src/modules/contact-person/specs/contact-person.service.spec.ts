import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { ContactPersonService } from '../contact-person.service';
import {
  ContactPersonEntity,
  ContactPersonRepository,
} from '../contact-person.repository';
import { CustomerRepository } from '../../customer/customer.repository';
import { PrismaService } from '../../../database/prisma.service';

function mockCustomer(overrides: Record<string, unknown> = {}) {
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

function mockContact(
  overrides: Partial<ContactPersonEntity> = {},
): ContactPersonEntity {
  return {
    id: 'cp-1',
    customerId: 'cust-1',
    name: 'Jane Doe',
    position: null,
    phone: null,
    email: null,
    isPrimary: false,
    organizationId: 'org-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ContactPersonService', () => {
  let service: ContactPersonService;
  let contactPersonRepository: jest.Mocked<ContactPersonRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    contactPersonRepository = {
      findById: jest.fn(),
      findAllByCustomer: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<ContactPersonRepository>;

    customerRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<CustomerRepository>;

    prisma = {
      contactPerson: {
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactPersonService,
        { provide: ContactPersonRepository, useValue: contactPersonRepository },
        { provide: CustomerRepository, useValue: customerRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContactPersonService>(ContactPersonService);
  });

  describe('create', () => {
    it('should persist a contact for a COMPANY customer with default isPrimary=false', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.create.mockResolvedValue(mockContact());

      const result = await service.create(
        'cust-1',
        { name: 'Jane Doe' },
        'org-1',
      );

      expect(contactPersonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          organizationId: 'org-1',
          name: 'Jane Doe',
          isPrimary: false,
        }),
      );
      expect(result.id).toBe('cp-1');
    });

    it('should persist a contact for a GOVERNMENT customer', async () => {
      customerRepository.findById.mockResolvedValue(
        mockCustomer({ type: CustomerType.GOVERNMENT }) as any,
      );
      contactPersonRepository.create.mockResolvedValue(mockContact());

      await service.create('cust-1', { name: 'Jane Doe' }, 'org-1');

      expect(contactPersonRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should reject 422 BUSINESS_RULE_VIOLATION when customer.type is INDIVIDUAL', async () => {
      customerRepository.findById.mockResolvedValue(
        mockCustomer({ type: CustomerType.INDIVIDUAL }) as any,
      );

      await expect(
        service.create('cust-1', { name: 'Jane Doe' }, 'org-1'),
      ).rejects.toThrow(HttpException);
      expect(contactPersonRepository.create).not.toHaveBeenCalled();
    });

    it('should reject 404 when parent customer is not in active org', async () => {
      customerRepository.findById.mockResolvedValue(null);

      await expect(
        service.create('cust-1', { name: 'Jane Doe' }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create with isPrimary=true and clear no siblings when none exist', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);

      const tx = {
        contactPerson: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue(mockContact({ isPrimary: true })),
        },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.create(
        'cust-1',
        { name: 'Jane Doe', isPrimary: true },
        'org-1',
      );

      expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isPrimary: true, isDeleted: false },
        data: { isPrimary: false },
      });
      expect(tx.contactPerson.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            organizationId: 'org-1',
            isPrimary: true,
          }),
        }),
      );
      expect(result.isPrimary).toBe(true);
    });

    it('should clear existing primary in same transaction when creating with isPrimary=true', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);

      const tx = {
        contactPerson: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest
            .fn()
            .mockResolvedValue(mockContact({ id: 'cp-2', isPrimary: true })),
        },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.create(
        'cust-1',
        { name: 'New Primary', isPrimary: true },
        'org-1',
      );

      expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isPrimary: true, isDeleted: false },
        data: { isPrimary: false },
      });
      expect(tx.contactPerson.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('cp-2');
      expect(result.isPrimary).toBe(true);
    });
  });

  describe('findAllByCustomer', () => {
    it('should return contacts scoped by customerId AND organizationId', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findAllByCustomer.mockResolvedValue([
        mockContact(),
        mockContact({ id: 'cp-2', name: 'John Smith' }),
      ]);

      const result = await service.findAllByCustomer('cust-1', 'org-1');

      expect(contactPersonRepository.findAllByCustomer).toHaveBeenCalledWith(
        'cust-1',
        'org-1',
      );
      expect(result).toHaveLength(2);
    });

    it('should reject 404 when customer is not in active org', async () => {
      customerRepository.findById.mockResolvedValue(null);

      await expect(
        service.findAllByCustomer('cust-1', 'org-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject 422 when customer.type is INDIVIDUAL', async () => {
      customerRepository.findById.mockResolvedValue(
        mockCustomer({ type: CustomerType.INDIVIDUAL }) as any,
      );

      await expect(
        service.findAllByCustomer('cust-1', 'org-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('findById', () => {
    it('should return the contact when it belongs to the customer and org', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(mockContact());

      const result = await service.findById('cust-1', 'cp-1', 'org-1');

      expect(result.id).toBe('cp-1');
    });

    it('should reject 404 when contact belongs to a different customer', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(
        mockContact({ customerId: 'cust-OTHER' }),
      );

      await expect(service.findById('cust-1', 'cp-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject 404 when contact is not in the active org (repo returns null)', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(null);

      await expect(service.findById('cust-1', 'cp-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update non-primary fields without touching siblings', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(mockContact());
      contactPersonRepository.update.mockResolvedValue(
        mockContact({ name: 'Renamed' }),
      );

      const result = await service.update(
        'cust-1',
        'cp-1',
        { name: 'Renamed' },
        'org-1',
      );

      expect(contactPersonRepository.update).toHaveBeenCalledWith(
        'cp-1',
        expect.objectContaining({ name: 'Renamed' }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.name).toBe('Renamed');
    });

    it('should clear sibling primaries in transaction when isPrimary=true', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(
        mockContact({ isPrimary: false }),
      );

      const tx = {
        contactPerson: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue(mockContact({ isPrimary: true })),
        },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.update(
        'cust-1',
        'cp-1',
        { isPrimary: true },
        'org-1',
      );

      expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          id: { not: 'cp-1' },
          isPrimary: true,
          isDeleted: false,
        },
        data: { isPrimary: false },
      });
      expect(tx.contactPerson.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cp-1' },
          data: expect.objectContaining({ isPrimary: true }),
        }),
      );
      expect(result.isPrimary).toBe(true);
    });

    it('should unset primary without touching siblings when isPrimary=false', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(
        mockContact({ isPrimary: true }),
      );
      contactPersonRepository.update.mockResolvedValue(
        mockContact({ isPrimary: false }),
      );

      const result = await service.update(
        'cust-1',
        'cp-1',
        { isPrimary: false },
        'org-1',
      );

      expect(contactPersonRepository.update).toHaveBeenCalledWith(
        'cp-1',
        expect.objectContaining({ isPrimary: false }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.isPrimary).toBe(false);
    });

    it('should reject 404 on cross-customer update attempt', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(
        mockContact({ customerId: 'cust-OTHER' }),
      );

      await expect(
        service.update('cust-1', 'cp-1', { name: 'Renamed' }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject 404 on cross-org update attempt (repo returns null)', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('cust-1', 'cp-1', { name: 'Renamed' }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft-delete the contact', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(mockContact());

      await service.delete('cust-1', 'cp-1', 'org-1');

      expect(contactPersonRepository.softDelete).toHaveBeenCalledWith('cp-1');
    });

    it('should reject 404 on cross-customer delete', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(
        mockContact({ customerId: 'cust-OTHER' }),
      );

      await expect(service.delete('cust-1', 'cp-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(contactPersonRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should reject 404 on cross-org delete', async () => {
      customerRepository.findById.mockResolvedValue(mockCustomer() as any);
      contactPersonRepository.findById.mockResolvedValue(null);

      await expect(service.delete('cust-1', 'cp-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(contactPersonRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
