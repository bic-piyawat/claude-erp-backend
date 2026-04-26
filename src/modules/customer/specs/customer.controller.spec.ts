import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from '../customer.controller';
import { CustomerService } from '../customer.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
  };
}

function mockCustomer(overrides = {}) {
  return {
    id: 'cust-1',
    name: 'Acme Corp',
    taxId: null,
    phone: null,
    email: null,
    address: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('CustomerController', () => {
  let controller: CustomerController;
  let service: jest.Mocked<CustomerService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CustomerService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        { provide: CustomerService, useValue: service },
        {
          provide: AuditTrailInterceptor,
          useValue: { intercept: jest.fn((ctx, next) => next.handle()) },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CustomerController>(CustomerController);
  });

  it('should return paginated customers', async () => {
    service.findAll.mockResolvedValue({
      data: [mockCustomer()],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
      itemsPerPage: 20,
    });

    const result = await controller.findAll(mockRequest() as any, {});

    expect(result.data).toHaveLength(1);
  });

  it('should create a customer', async () => {
    service.create.mockResolvedValue(mockCustomer());

    const result = await controller.create(mockRequest() as any, {
      name: 'Acme Corp',
    });

    expect(result.name).toBe('Acme Corp');
  });

  it('should get a customer by id', async () => {
    service.findById.mockResolvedValue(mockCustomer());

    const result = await controller.findById(mockRequest() as any, 'cust-1');

    expect(result.id).toBe('cust-1');
  });

  it('should update a customer', async () => {
    service.update.mockResolvedValue(mockCustomer({ name: 'Updated' }));

    const result = await controller.update(mockRequest() as any, 'cust-1', {
      name: 'Updated',
    });

    expect(result.name).toBe('Updated');
  });

  it('should soft delete a customer', async () => {
    service.delete.mockResolvedValue(undefined);

    await controller.delete(mockRequest() as any, 'cust-1');

    expect(service.delete).toHaveBeenCalledWith('cust-1', 'org-1');
  });
});
