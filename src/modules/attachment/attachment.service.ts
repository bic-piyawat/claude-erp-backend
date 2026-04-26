import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentRepository,
  AttachmentEntity,
} from './attachment.repository';
import { cloudinary, configureCloudinary } from './cloudinary.config';

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadFileData {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

@Injectable()
export class AttachmentService {
  constructor(private readonly attachmentRepository: AttachmentRepository) {
    configureCloudinary();
  }

  async findAllByProject(projectId: string): Promise<AttachmentEntity[]> {
    return this.attachmentRepository.findAllByProject(projectId);
  }

  async upload(
    projectId: string,
    organizationId: string,
    userId: string,
    file: UploadFileData,
  ): Promise<AttachmentEntity> {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds 10MB limit');
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: `${organizationId}/${projectId}`,
    });

    const extension = file.originalname.split('.').pop()?.toUpperCase() ?? '';

    return this.attachmentRepository.create({
      projectId,
      fileName: file.originalname,
      fileType: extension,
      fileSize: file.size,
      storagePath: result.secure_url,
      cloudinaryPublicId: result.public_id,
      uploadedBy: userId,
      organizationId,
    });
  }

  async delete(projectId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findById(attachmentId);
    if (!attachment || attachment.projectId !== projectId) {
      throw new NotFoundException('Attachment not found');
    }

    await cloudinary.uploader.destroy(attachment.cloudinaryPublicId);
    await this.attachmentRepository.delete(attachmentId);
  }
}
