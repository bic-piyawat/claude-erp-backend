import { Test, TestingModule } from '@nestjs/testing';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ProjectController } from '../project.controller';
import { ProjectService } from '../project.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId], role: 'FOUNDER' },
  };
}

function mockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Acme Pipeline',
    status: 'DRAFT',
    ownerId: 'u-1',
    customerId: null,
    totalProjectPrice: null,
    expectedCloseDate: null,
    stageId: null,
    customerPoNumber: null,
    customerPoIssuedDate: null,
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: jest.Mocked<ProjectService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transitionStage: jest.fn(),
      getProfitability: jest.fn(),
      syncMaster: jest.fn(),
      syncMasterApply: jest.fn(),
      getDraftPO: jest.fn(),
      getAuditLog: jest.fn(),
    } as unknown as jest.Mocked<ProjectService>;

    const mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: service },
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

    controller = module.get<ProjectController>(ProjectController);
  });

  it('should return paginated projects', async () => {
    service.findAll.mockResolvedValue({
      data: [mockProject() as never],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
      itemsPerPage: 20,
    });

    const result = await controller.findAll(mockRequest() as never, {});

    expect(result.data).toHaveLength(1);
  });

  it('should create a project', async () => {
    service.create.mockResolvedValue(mockProject() as never);

    const result = await controller.create(mockRequest() as never, {
      name: 'Acme Pipeline',
    } as never);

    expect(result.name).toBe('Acme Pipeline');
  });

  it('should get a project by id', async () => {
    service.findById.mockResolvedValue(mockProject() as never);

    const result = await controller.findById(mockRequest() as never, 'proj-1');

    expect(result.id).toBe('proj-1');
  });

  it('should update a project', async () => {
    service.update.mockResolvedValue(
      mockProject({ name: 'Updated' }) as never,
    );

    const result = await controller.update(mockRequest() as never, 'proj-1', {
      name: 'Updated',
    } as never);

    expect(result.name).toBe('Updated');
  });

  it('should soft delete a project', async () => {
    service.delete.mockResolvedValue(undefined);

    await controller.delete(mockRequest() as never, 'proj-1');

    expect(service.delete).toHaveBeenCalledWith('proj-1', 'org-1');
  });

  describe('AuditTrailInterceptor wiring (PRJ-022)', () => {
    it('should declare AuditTrailInterceptor on update handler', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        ProjectController.prototype.update,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });

    it('should declare AuditTrailInterceptor on delete handler', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        ProjectController.prototype.delete,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });
  });
});
