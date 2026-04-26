import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface StageEntity {
  id: string;
  name: string;
  order: number;
  isStandard: boolean;
  organizationId: string;
}

@Injectable()
export class StageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrganization(organizationId: string): Promise<StageEntity[]> {
    return this.prisma.stage.findMany({
      where: { organizationId, isDeleted: false },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        isStandard: true,
        organizationId: true,
      },
    });
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<StageEntity | null> {
    return this.prisma.stage.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: {
        id: true,
        name: true,
        order: true,
        isStandard: true,
        organizationId: true,
      },
    });
  }

  async create(
    organizationId: string,
    name: string,
    order: number,
  ): Promise<StageEntity> {
    return this.prisma.stage.create({
      data: { name, order, organizationId },
      select: {
        id: true,
        name: true,
        order: true,
        isStandard: true,
        organizationId: true,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; order?: number },
  ): Promise<StageEntity> {
    return this.prisma.stage.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        order: true,
        isStandard: true,
        organizationId: true,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.stage.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async hasActiveProjects(id: string): Promise<boolean> {
    const count = await this.prisma.project.count({
      where: { stageId: id, isDeleted: false },
    });
    return count > 0;
  }

  async reorder(stages: { id: string; order: number }[]): Promise<void> {
    await this.prisma.$transaction(
      stages.map((s) =>
        this.prisma.stage.update({
          where: { id: s.id },
          data: { order: s.order },
        }),
      ),
    );
  }
}
