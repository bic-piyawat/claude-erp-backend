import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AttachmentEntity {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  cloudinaryPublicId: string;
  uploadedBy: string;
  uploadedAt: Date;
  organizationId: string;
}

@Injectable()
export class AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(projectId: string): Promise<AttachmentEntity[]> {
    return this.prisma.attachment.findMany({
      where: { projectId },
      orderBy: { uploadedAt: 'desc' },
    }) as Promise<AttachmentEntity[]>;
  }

  async findById(id: string): Promise<AttachmentEntity | null> {
    return this.prisma.attachment.findUnique({
      where: { id },
    }) as Promise<AttachmentEntity | null>;
  }

  async create(
    data: Omit<AttachmentEntity, 'id' | 'uploadedAt'>,
  ): Promise<AttachmentEntity> {
    return this.prisma.attachment.create({ data }) as Promise<AttachmentEntity>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { id } });
  }
}
