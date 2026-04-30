import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactPersonController } from '../contact-person.controller';
import { ContactPersonService } from '../contact-person.service';
import { ContactPersonEntity } from '../contact-person.repository';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
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

describe('ContactPersonController', () => {
  let controller: ContactPersonController;
  let service: jest.Mocked<ContactPersonService>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAllByCustomer: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ContactPersonService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactPersonController],
      providers: [
        { provide: ContactPersonService, useValue: service },
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

    controller = module.get<ContactPersonController>(ContactPersonController);
  });

  describe('create (POST customers/:customerId/contacts)', () => {
    it('returns 201 with the created contact', async () => {
      service.create.mockResolvedValue(mockContact());

      const result = await controller.create(mockRequest() as any, 'cust-1', {
        name: 'Jane Doe',
      });

      expect(service.create).toHaveBeenCalledWith(
        'cust-1',
        { name: 'Jane Doe' },
        'org-1',
      );
      expect(result.id).toBe('cp-1');
    });

    it('propagates 404 when customer unknown', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Customer not found'),
      );

      await expect(
        controller.create(mockRequest() as any, 'unknown', {
          name: 'Jane Doe',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll (GET customers/:customerId/contacts)', () => {
    it('returns 200 with the customer contacts', async () => {
      service.findAllByCustomer.mockResolvedValue([
        mockContact(),
        mockContact({ id: 'cp-2', name: 'John Smith' }),
      ]);

      const result = await controller.findAll(mockRequest() as any, 'cust-1');

      expect(service.findAllByCustomer).toHaveBeenCalledWith('cust-1', 'org-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('update (PATCH customers/:customerId/contacts/:contactId)', () => {
    it('returns 200 with the updated contact', async () => {
      service.update.mockResolvedValue(mockContact({ name: 'Renamed' }));

      const result = await controller.update(
        mockRequest() as any,
        'cust-1',
        'cp-1',
        { name: 'Renamed' },
      );

      expect(service.update).toHaveBeenCalledWith(
        'cust-1',
        'cp-1',
        { name: 'Renamed' },
        'org-1',
      );
      expect(result.name).toBe('Renamed');
    });
  });

  describe('delete (DELETE customers/:customerId/contacts/:contactId)', () => {
    it('returns 204 (no content) and calls service with correct args', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(mockRequest() as any, 'cust-1', 'cp-1');

      expect(service.delete).toHaveBeenCalledWith('cust-1', 'cp-1', 'org-1');
    });
  });
});
