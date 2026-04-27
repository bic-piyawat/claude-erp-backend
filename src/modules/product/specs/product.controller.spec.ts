import { Test, TestingModule } from '@nestjs/testing';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ProductController } from '../product.controller';
import { ProductService } from '../product.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
  };
}

function mockProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    name: 'Widget',
    uom: null,
    category: null,
    standardCost: 0,
    lastPrice: 0,
    lastUpdatedDate: null,
    defaultSupplierId: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ProductService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: service },
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

    controller = module.get<ProductController>(ProductController);
  });

  it('should return paginated products', async () => {
    service.findAll.mockResolvedValue({
      data: [mockProduct() as never],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
      itemsPerPage: 20,
    });

    const result = await controller.findAll(mockRequest() as never, {});

    expect(result.data).toHaveLength(1);
  });

  it('should create a product', async () => {
    service.create.mockResolvedValue(mockProduct() as never);

    const result = await controller.create(mockRequest() as never, {
      name: 'Widget',
    } as never);

    expect(result.name).toBe('Widget');
  });

  it('should get a product by id', async () => {
    service.findById.mockResolvedValue(mockProduct() as never);

    const result = await controller.findById(mockRequest() as never, 'prod-1');

    expect(result.id).toBe('prod-1');
  });

  it('should update a product', async () => {
    service.update.mockResolvedValue(
      mockProduct({ name: 'Updated' }) as never,
    );

    const result = await controller.update(mockRequest() as never, 'prod-1', {
      name: 'Updated',
    } as never);

    expect(result.name).toBe('Updated');
  });

  it('should soft delete a product', async () => {
    service.delete.mockResolvedValue(undefined);

    await controller.delete(mockRequest() as never, 'prod-1');

    expect(service.delete).toHaveBeenCalledWith('prod-1', 'org-1');
  });

  describe('AuditTrailInterceptor wiring (PRJ-022)', () => {
    it('should declare AuditTrailInterceptor on update handler', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        ProductController.prototype.update,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });

    it('should declare AuditTrailInterceptor on delete handler', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        ProductController.prototype.delete,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });
  });
});
