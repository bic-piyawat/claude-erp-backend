import { Test, TestingModule } from '@nestjs/testing';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { AttachmentCategory } from '@prisma/client';
import { AttachmentController } from '../attachment.controller';
import { AttachmentService } from '../attachment.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../../common/interceptors/audit-trail.interceptor';
import { PrismaService } from '../../../database/prisma.service';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId] },
  };
}

function mockAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    projectId: 'proj-1',
    fileName: 'po.pdf',
    fileType: 'PDF',
    fileSize: 1024,
    storagePath: 'https://res.cloudinary.com/po.pdf',
    cloudinaryPublicId: 'org-1/proj-1/po',
    uploadedBy: 'u-1',
    uploadedAt: new Date(),
    category: AttachmentCategory.OTHER,
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('AttachmentController', () => {
  let controller: AttachmentController;
  let service: jest.Mocked<AttachmentService>;

  beforeEach(async () => {
    service = {
      findAllByProject: jest.fn(),
      upload: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AttachmentService>;

    const mockPrisma = { auditLog: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentController],
      providers: [
        { provide: AttachmentService, useValue: service },
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

    controller = module.get<AttachmentController>(AttachmentController);
  });

  describe('findAll (GET projects/:projectId/attachments)', () => {
    it('passes category filter from query through to the service', async () => {
      service.findAllByProject.mockResolvedValue([
        mockAttachment({ category: AttachmentCategory.CUSTOMER_PO }) as never,
      ]);

      const result = await controller.findAll('proj-1', {
        category: AttachmentCategory.CUSTOMER_PO,
      });

      expect(service.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        AttachmentCategory.CUSTOMER_PO,
      );
      expect(result).toHaveLength(1);
    });

    it('forwards undefined when no filter is supplied', async () => {
      service.findAllByProject.mockResolvedValue([mockAttachment() as never]);

      await controller.findAll('proj-1', {});

      expect(service.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        undefined,
      );
    });
  });

  describe('upload (POST projects/:projectId/attachments)', () => {
    const file = {
      originalname: 'po.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      path: '/tmp/po.pdf',
    } as Express.Multer.File;

    it('returns 201 with the persisted category', async () => {
      service.upload.mockResolvedValue(
        mockAttachment({ category: AttachmentCategory.CUSTOMER_PO }) as never,
      );

      const result = await controller.upload(
        mockRequest() as never,
        'proj-1',
        file,
        { category: AttachmentCategory.CUSTOMER_PO },
      );

      expect(service.upload).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
        'u-1',
        file,
        AttachmentCategory.CUSTOMER_PO,
      );
      expect(result.category).toBe(AttachmentCategory.CUSTOMER_PO);
    });

    it('passes undefined category when omitted from form-data', async () => {
      service.upload.mockResolvedValue(mockAttachment() as never);

      await controller.upload(mockRequest() as never, 'proj-1', file, {});

      expect(service.upload).toHaveBeenCalledWith(
        'proj-1',
        'org-1',
        'u-1',
        file,
        undefined,
      );
    });
  });

  describe('AuditTrailInterceptor wiring', () => {
    it('declares AuditTrailInterceptor at controller class level', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        AttachmentController,
      );

      expect(interceptors).toContain(AuditTrailInterceptor);
    });
  });
});
