import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentCategory } from '@prisma/client';
import { AttachmentService } from '../attachment.service';
import { AttachmentRepository } from '../attachment.repository';

// Mock cloudinary before importing
jest.mock('../cloudinary.config', () => ({
  configureCloudinary: jest.fn(),
  cloudinary: {
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

import { cloudinary } from '../cloudinary.config';

function mockAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    projectId: 'proj-1',
    fileName: 'contract.pdf',
    fileType: 'PDF',
    fileSize: 1024,
    storagePath: 'https://res.cloudinary.com/test/image/upload/test.pdf',
    cloudinaryPublicId: 'org-1/proj-1/contract',
    uploadedBy: 'u-1',
    uploadedAt: new Date(),
    category: AttachmentCategory.OTHER,
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('AttachmentService', () => {
  let service: AttachmentService;
  let repository: jest.Mocked<AttachmentRepository>;

  beforeEach(() => {
    repository = {
      findAllByProject: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AttachmentRepository>;

    service = new AttachmentService(repository);
  });

  describe('upload', () => {
    const validFile = {
      originalname: 'contract.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      path: '/tmp/contract.pdf',
    };

    it('should upload a valid PDF file', async () => {
      (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test.pdf',
        public_id: 'org-1/proj-1/contract',
      });
      repository.create.mockResolvedValue(mockAttachment());

      const result = await service.upload('proj-1', 'org-1', 'u-1', validFile);

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        '/tmp/contract.pdf',
        { folder: 'org-1/proj-1' },
      );
      expect(repository.create).toHaveBeenCalled();
      expect(result.fileName).toBe('contract.pdf');
    });

    it('should throw BadRequestException for disallowed file type', async () => {
      const invalidFile = { ...validFile, mimetype: 'text/html' };

      await expect(
        service.upload('proj-1', 'org-1', 'u-1', invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds 10MB', async () => {
      const largeFile = { ...validFile, size: 11 * 1024 * 1024 };

      await expect(
        service.upload('proj-1', 'org-1', 'u-1', largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should persist explicit category when provided', async () => {
      (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test.pdf',
        public_id: 'org-1/proj-1/contract',
      });
      repository.create.mockResolvedValue(
        mockAttachment({ category: AttachmentCategory.CUSTOMER_PO }) as never,
      );

      const result = await service.upload(
        'proj-1',
        'org-1',
        'u-1',
        validFile,
        AttachmentCategory.CUSTOMER_PO,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ category: AttachmentCategory.CUSTOMER_PO }),
      );
      expect(result.category).toBe(AttachmentCategory.CUSTOMER_PO);
    });

    it('should default to OTHER when no category is provided', async () => {
      (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test.pdf',
        public_id: 'org-1/proj-1/contract',
      });
      repository.create.mockResolvedValue(mockAttachment() as never);

      await service.upload('proj-1', 'org-1', 'u-1', validFile);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ category: AttachmentCategory.OTHER }),
      );
    });
  });

  describe('findAllByProject', () => {
    it('forwards category filter when provided', async () => {
      repository.findAllByProject.mockResolvedValue([
        mockAttachment({ category: AttachmentCategory.CUSTOMER_PO }) as never,
      ]);

      const result = await service.findAllByProject(
        'proj-1',
        AttachmentCategory.CUSTOMER_PO,
      );

      expect(repository.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        AttachmentCategory.CUSTOMER_PO,
      );
      expect(result).toHaveLength(1);
    });

    it('passes undefined category when no filter is provided', async () => {
      repository.findAllByProject.mockResolvedValue([
        mockAttachment() as never,
      ]);

      await service.findAllByProject('proj-1');

      expect(repository.findAllByProject).toHaveBeenCalledWith(
        'proj-1',
        undefined,
      );
    });
  });

  describe('delete', () => {
    it('should delete attachment from Cloudinary and DB', async () => {
      repository.findById.mockResolvedValue(mockAttachment());
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({
        result: 'ok',
      });

      await service.delete('proj-1', 'att-1');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        'org-1/proj-1/contract',
      );
      expect(repository.delete).toHaveBeenCalledWith('att-1');
    });

    it('should throw NotFoundException when attachment not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('proj-1', 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
