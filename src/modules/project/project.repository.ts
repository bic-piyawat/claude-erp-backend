import { Injectable } from '@nestjs/common';
import { Prisma, BudgetStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProjectStatus } from '@prisma/client';
import { PaginatedResult } from '../customer/customer.repository';
import { ProjectSortField } from './dto/query-project.dto';

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
  totalProjectPrice: number | null;
  totalCost: number;
  expectedCloseDate: Date | null;
  organizationId: string;
  createdAt: Date;
}

export interface ProjectDetail {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerId: string;
  ownerName: string;
  customerId: string | null;
  stageId: string | null;
  totalProjectPrice: number | null;
  expectedCloseDate: Date | null;
  customerPoNumber: string | null;
  customerPoIssuedDate: Date | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  stage: { id: string; name: string } | null;
  customFieldValues: { definitionId: string; value: string | null }[];
  attachments: unknown[];
}

/**
 * Compose a human-readable owner name from the User row's firstName / lastName,
 * falling back to email when both name fields are blank/null. Mirrors how the
 * mockup at `docs/ui-design/project-detail-page-ui-design.html` displays the
 * owner ("Owner Bic Piyawat") in the project detail header.
 */
function composeOwnerName(owner: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const fullName = [owner.firstName, owner.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return fullName || owner.email;
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
    customerId?: string,
    sortBy?: ProjectSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<PaginatedResult<ProjectListItem>> {
    const dir: 'asc' | 'desc' = sortDir ?? 'desc';
    const where: Prisma.ProjectWhereInput = {
      organizationId,
      isDeleted: false,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { owner: { firstName: { contains: search } } },
              { owner: { lastName: { contains: search } } },
              { owner: { email: { contains: search } } },
              { customer: { name: { contains: search } } },
            ],
          }
        : {}),
      ...(stageId ? { stageId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(customerId ? { customerId } : {}),
    };

    // Build Prisma orderBy from the validated sortBy allow-list. `totalCost` cannot
    // be sorted via Prisma orderBy directly because it is an aggregate computed
    // from CostItem rows (net-of-VAT per row). When sortBy === 'totalCost' we
    // skip DB-level sort, fetch the page (after pagination) and sort in-memory
    // after computing totalCost. Acceptable for v1 because limit=20 — for a
    // larger page size we would need a DB-side aggregate (raw SQL) or a
    // denormalized projects.totalCost column.
    const isInMemorySort = sortBy === 'totalCost';
    let orderBy:
      | Prisma.ProjectOrderByWithRelationInput
      | Prisma.ProjectOrderByWithRelationInput[];
    if (!sortBy) {
      orderBy = { createdAt: 'desc' };
    } else {
      switch (sortBy) {
        case 'name':
          orderBy = { name: dir };
          break;
        case 'ownerName':
          orderBy = [
            { owner: { firstName: dir } },
            { owner: { lastName: dir } },
          ];
          break;
        case 'customerName':
          orderBy = { customer: { name: dir } };
          break;
        case 'stageName':
          orderBy = { stage: { name: dir } };
          break;
        case 'status':
          orderBy = { status: dir };
          break;
        case 'totalProjectPrice':
          orderBy = { totalProjectPrice: dir };
          break;
        case 'createdAt':
          orderBy = { createdAt: dir };
          break;
        case 'expectedCloseDate':
          orderBy = { expectedCloseDate: dir };
          break;
        case 'totalCost':
          // Stable secondary order while we re-sort in memory after the fetch.
          orderBy = { createdAt: 'desc' };
          break;
      }
    }

    const totalItems = await this.prisma.project.count({ where });

    // For in-memory `totalCost` sort we still rely on DB pagination because the
    // page is small (limit=20 v1). The result order within the page reflects
    // the computed cost; cross-page ordering is therefore approximate. This is
    // documented in PRJ-077-BE.
    const items = await this.prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        customer: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
      },
    });

    const projectIds = items.map((p) => p.id);
    const draftBudgets = projectIds.length
      ? await this.prisma.budget.findMany({
          where: { projectId: { in: projectIds }, status: BudgetStatus.DRAFT },
          include: { costItems: true },
        })
      : [];
    const budgetByProject = new Map(draftBudgets.map((b) => [b.projectId, b]));

    let data: ProjectListItem[] = items.map((p) => {
      const budget = budgetByProject.get(p.id);
      let totalCost = 0;
      if (budget) {
        const vatFactor = 1 + budget.vatRate;
        const netCost = budget.costItems.reduce((sum, item) => {
          const net = item.vatIncluded
            ? item.lineTotal / vatFactor
            : item.lineTotal;
          return sum + net;
        }, 0);
        totalCost = Math.round(netCost * 100) / 100;
      }
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        ownerId: p.ownerId,
        ownerName: composeOwnerName(p.owner),
        customerId: p.customerId,
        customerName: p.customer?.name ?? null,
        stageId: p.stageId,
        stageName: p.stage?.name ?? null,
        totalProjectPrice: p.totalProjectPrice,
        totalCost,
        expectedCloseDate: p.expectedCloseDate,
        organizationId: p.organizationId,
        createdAt: p.createdAt,
      };
    });

    if (isInMemorySort) {
      const factor = dir === 'asc' ? 1 : -1;
      data = [...data].sort((a, b) => (a.totalCost - b.totalCost) * factor);
    }

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
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        stage: { select: { id: true, name: true } },
        customFieldValues: { select: { definitionId: true, value: true } },
        attachments: true,
      },
    });
    if (!project) return null;
    const { owner, ...rest } = project;
    return {
      ...rest,
      ownerName: composeOwnerName(owner),
    } as ProjectDetail;
  }

  async create(data: {
    name: string;
    ownerId: string;
    customerId?: string;
    totalProjectPrice?: number;
    expectedCloseDate?: string;
    organizationId: string;
  }): Promise<{ id: string }> {
    return this.prisma.project.create({
      data: {
        name: data.name,
        ownerId: data.ownerId,
        customerId: data.customerId,
        totalProjectPrice: data.totalProjectPrice,
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
      totalProjectPrice?: number;
      expectedCloseDate?: string;
      customerPoNumber?: string;
      customerPoIssuedDate?: string;
      stageId?: string;
      status?: ProjectStatus;
    },
  ): Promise<ProjectDetail> {
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate
          ? new Date(data.expectedCloseDate)
          : undefined,
        customerPoIssuedDate: data.customerPoIssuedDate
          ? new Date(data.customerPoIssuedDate)
          : undefined,
      },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        stage: { select: { id: true, name: true } },
        customFieldValues: { select: { definitionId: true, value: true } },
        attachments: true,
      },
    });
    const { owner, ...rest } = updated;
    return {
      ...rest,
      ownerName: composeOwnerName(owner),
    } as ProjectDetail;
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
