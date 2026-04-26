import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProjectStatus } from '@prisma/client';
import { PaginatedResult } from '../customer/customer.repository';

export interface ProjectListItem {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerId: string;
  ownerName: string;
  customerId: string | null;
  customerName: string | null;
  stageId: string | null;
  stageName: string | null;
  estimatedRevenue: number | null;
  expectedCloseDate: Date | null;
  organizationId: string;
  createdAt: Date;
}

export interface ProjectDetail {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerId: string;
  customerId: string | null;
  stageId: string | null;
  estimatedRevenue: number | null;
  expectedCloseDate: Date | null;
  customerPoNumber: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  stage: { id: string; name: string } | null;
  customFieldValues: { definitionId: string; value: string | null }[];
  attachments: unknown[];
}

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    stageId: string | undefined,
    ownerId: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ProjectListItem>> {
    const where = {
      organizationId,
      isDeleted: false,
      ...(search ? { name: { contains: search } } : {}),
      ...(stageId ? { stageId } : {}),
      ...(ownerId ? { ownerId } : {}),
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, email: true } },
          customer: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const data: ProjectListItem[] = items.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      ownerId: p.ownerId,
      ownerName: p.owner.email,
      customerId: p.customerId,
      customerName: p.customer?.name ?? null,
      stageId: p.stageId,
      stageName: p.stage?.name ?? null,
      estimatedRevenue: p.estimatedRevenue,
      expectedCloseDate: p.expectedCloseDate,
      organizationId: p.organizationId,
      createdAt: p.createdAt,
    }));

    return {
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      itemsPerPage: limit,
    };
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ProjectDetail | null> {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: {
        stage: { select: { id: true, name: true } },
        customFieldValues: { select: { definitionId: true, value: true } },
        attachments: true,
      },
    });
    return project as ProjectDetail | null;
  }

  async create(data: {
    name: string;
    ownerId: string;
    customerId?: string;
    estimatedRevenue?: number;
    expectedCloseDate?: string;
    organizationId: string;
  }): Promise<{ id: string }> {
    return this.prisma.project.create({
      data: {
        name: data.name,
        ownerId: data.ownerId,
        customerId: data.customerId,
        estimatedRevenue: data.estimatedRevenue,
        expectedCloseDate: data.expectedCloseDate
          ? new Date(data.expectedCloseDate)
          : undefined,
        organizationId: data.organizationId,
      },
      select: { id: true },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      ownerId?: string;
      customerId?: string;
      estimatedRevenue?: number;
      expectedCloseDate?: string;
      customerPoNumber?: string;
      stageId?: string;
      status?: ProjectStatus;
    },
  ): Promise<ProjectDetail> {
    return this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate
          ? new Date(data.expectedCloseDate)
          : undefined,
      },
      include: {
        stage: { select: { id: true, name: true } },
        customFieldValues: { select: { definitionId: true, value: true } },
        attachments: true,
      },
    }) as Promise<ProjectDetail>;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async upsertCustomFieldValues(
    projectId: string,
    values: { fieldId: string; value?: string }[],
  ): Promise<void> {
    await this.prisma.$transaction(
      values.map((v) =>
        this.prisma.customFieldValue.upsert({
          where: {
            definitionId_projectId: { definitionId: v.fieldId, projectId },
          },
          create: { definitionId: v.fieldId, projectId, value: v.value },
          update: { value: v.value },
        }),
      ),
    );
  }

  async recordStageHistory(
    projectId: string,
    fromStageId: string | null,
    toStageId: string,
    changedBy: string,
  ): Promise<void> {
    await this.prisma.projectStageHistory.create({
      data: { projectId, fromStageId, toStageId, changedBy },
    });
  }
}
