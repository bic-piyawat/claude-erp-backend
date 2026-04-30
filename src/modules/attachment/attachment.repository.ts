import { Injectable } from '@nestjs/common';
import { AttachmentCategory } from '@prisma/client';
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
  category: AttachmentCategory;
  organizationId: string;
}

@Injectable()
export class AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(
    projectId: string,
    category?: AttachmentCategory,
  ): Promise<AttachmentEntity[]> {
    return this.prisma.attachment.findMany({
      where: { projectId, ...(category ? { category } : {}) },
      orderBy: { uploadedAt: 'desc' },
    }) as Promise<AttachmentEntity[]>;
  }

  async findById(id: string): Promise<AttachmentEntity | null> {
    return this.prisma.attachment.findUnique({
      where: { id },
    }) as Promise<AttachmentEntity | null>;
  }

  async create(
    data: Omit<AttachmentEntity, 'id' | 'uploadedAt' | 'category'> & {
      category?: AttachmentCategory;
    },
  ): Promise<AttachmentEntity> {
    return this.prisma.attachment.create({
      data: { ...data, category: data.category ?? 'OTHER' },
    }) as Promise<AttachmentEntity>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { id } });
  }
}
