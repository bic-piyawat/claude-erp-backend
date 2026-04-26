import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProjectRepository,
  ProjectDetail,
  ProjectListItem,
} from './project.repository';
import { BudgetRepository } from '../budget/budget.repository';
import { OrganizationSettingsService } from '../organization-settings/organization-settings.service';
import {
  ProfitabilityService,
  ProfitabilityResult,
} from './profitability.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { StageTransitionDto } from './dto/stage-transition.dto';
import { PaginatedResult } from '../customer/customer.repository';
import { Role } from '../../common/enums/role.enum';

const BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly organizationSettingsService: OrganizationSettingsService,
    private readonly profitabilityService: ProfitabilityService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    stageId: string | undefined,
    ownerId: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ProjectListItem>> {
    return this.projectRepository.findAll(
      organizationId,
      search,
      stageId,
      ownerId,
      page,
      limit,
    );
  }

  async findById(id: string, organizationId: string): Promise<ProjectDetail> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectDetail> {
    const effectiveOwnerId = dto.ownerId || userId;
    const membership = await this.prisma.membership.findFirst({
      where: { userId: effectiveOwnerId, organizationId },
    });
    if (!membership) {
      throw new BadRequestException(
        'Owner must be a member of this organization',
      );
    }

    const settings =
      await this.organizationSettingsService.getSettings(organizationId);

    const project = await this.projectRepository.create({
      name: dto.name,
      ownerId: effectiveOwnerId,
      customerId: dto.customerId,
      estimatedRevenue: dto.estimatedRevenue,
      expectedCloseDate: dto.expectedCloseDate,
      organizationId,
    });

    await this.budgetRepository.createVersion(
      project.id,
      1,
      settings.vatRate,
      userId,
      [],
    );

    if (dto.customFieldValues && dto.customFieldValues.length > 0) {
      await this.validateAndUpsertCustomFields(
        project.id,
        organizationId,
        dto.customFieldValues,
      );
    }

    return this.projectRepository.findById(
      project.id,
      organizationId,
    ) as Promise<ProjectDetail>;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDetail> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    if ('status' in dto || 'stageId' in dto) {
      throw new HttpException(
        {
          statusCode: 422,
          code: BUSINESS_RULE_VIOLATION,
          message: 'Use /stage endpoint to change stage or status',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const { customFieldValues, ...projectData } = dto;

    await this.projectRepository.update(id, projectData);

    if (customFieldValues && customFieldValues.length > 0) {
      await this.validateAndUpsertCustomFields(
        id,
        organizationId,
        customFieldValues,
      );
    }

    return this.projectRepository.findById(
      id,
      organizationId,
    ) as Promise<ProjectDetail>;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    if (project.status === 'CLOSED_WON') {
      throw new HttpException(
        {
          statusCode: 422,
          code: BUSINESS_RULE_VIOLATION,
          message: 'Cannot delete a CLOSED_WON project',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.projectRepository.softDelete(id);
  }

  async transitionStage(
    id: string,
    organizationId: string,
    userId: string,
    userRole: string | undefined,
    dto: StageTransitionDto,
  ): Promise<ProjectDetail> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const targetStage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, organizationId, isDeleted: false },
    });
    if (!targetStage) throw new NotFoundException('Target stage not found');

    const isClosedWon =
      targetStage.name === 'CLOSED_WON' ||
      (await this.isClosingStage(dto.stageId, organizationId));

    if (project.status === 'CLOSED_WON') {
      if (userRole !== Role.SUPER_ADMIN && userRole !== Role.FOUNDER) {
        throw new ForbiddenException(
          'Only SUPER_ADMIN or FOUNDER can move project out of CLOSED_WON',
        );
      }
      await this.projectRepository.recordStageHistory(
        id,
        project.stageId,
        dto.stageId,
        userId,
      );
      return this.projectRepository.update(id, {
        stageId: dto.stageId,
        status: 'ACTIVE',
      });
    }

    if (isClosedWon) {
      if (!dto.customerPoNumber || dto.customerPoNumber.trim() === '') {
        throw new HttpException(
          {
            statusCode: 422,
            code: BUSINESS_RULE_VIOLATION,
            message: 'customerPoNumber is required to close',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const attachmentCount = await this.prisma.attachment.count({
        where: { projectId: id },
      });
      if (attachmentCount < 1) {
        throw new HttpException(
          {
            statusCode: 422,
            code: BUSINESS_RULE_VIOLATION,
            message: 'At least one attachment is required to close',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const currentBudget =
        await this.budgetRepository.findCurrentByProject(id);
      if (currentBudget) {
        await this.budgetRepository.lockBudget(currentBudget.id);

        const nextVersion = currentBudget.version + 1;
        await this.budgetRepository.createVersion(
          id,
          nextVersion,
          currentBudget.vatRate,
          userId,
          currentBudget.costItems,
        );

        await this.prisma.$transaction(
          currentBudget.costItems
            .filter((item) => item.productId && item.unitPrice)
            .map((item) =>
              this.prisma.product.update({
                where: { id: item.productId! },
                data: {
                  lastPrice: item.unitPrice,
                  lastUpdatedDate: new Date(),
                },
              }),
            ),
        );
      }

      await this.projectRepository.recordStageHistory(
        id,
        project.stageId,
        dto.stageId,
        userId,
      );
      return this.projectRepository.update(id, {
        stageId: dto.stageId,
        status: 'CLOSED_WON',
        customerPoNumber: dto.customerPoNumber,
      });
    }

    await this.projectRepository.recordStageHistory(
      id,
      project.stageId,
      dto.stageId,
      userId,
    );
    return this.projectRepository.update(id, { stageId: dto.stageId });
  }

  private async isClosingStage(
    stageId: string,
    organizationId: string,
  ): Promise<boolean> {
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, organizationId },
    });
    return stage?.name?.toLowerCase().includes('closed won') || false;
  }

  async getProfitability(
    id: string,
    organizationId: string,
  ): Promise<ProfitabilityResult> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const settings =
      await this.organizationSettingsService.getSettings(organizationId);
    const currentBudget = await this.budgetRepository.findCurrentByProject(id);

    const costItems = (currentBudget?.costItems ?? []).map((item) => ({
      lineTotal: item.lineTotal,
      vatIncluded: item.vatIncluded,
    }));

    return this.profitabilityService.compute(
      project.estimatedRevenue ?? 0,
      settings.vatRate,
      costItems,
    );
  }

  async syncMaster(id: string, organizationId: string) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    if (project.status === 'CLOSED_WON') {
      throw new ForbiddenException('Cannot sync master for CLOSED_WON project');
    }

    const currentBudget = await this.budgetRepository.findCurrentByProject(id);
    if (!currentBudget) return { diffs: [] };

    const diffs = [];
    for (const item of currentBudget.costItems.filter((i) => i.productId)) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId! },
      });
      if (product && product.lastPrice !== item.unitPrice) {
        const projectedGpImpact =
          (item.unitPrice - product.lastPrice) * item.qty;
        diffs.push({
          costItemId: item.id,
          productName: item.productName,
          currentUnitPrice: item.unitPrice,
          masterLastPrice: product.lastPrice,
          projectedGpImpact,
        });
      }
    }

    return { diffs };
  }

  async syncMasterApply(
    id: string,
    organizationId: string,
    userId: string,
    itemIds: string[],
  ) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const currentBudget = await this.budgetRepository.findCurrentByProject(id);
    if (!currentBudget) throw new NotFoundException('No budget found');

    const updatedItems = [];
    for (const itemId of itemIds) {
      const item = currentBudget.costItems.find((i) => i.id === itemId);
      if (!item || !item.productId) continue;

      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) continue;

      const newLineTotal =
        item.qty * product.lastPrice * (1 + item.safetyBufferPercent / 100);
      await this.prisma.costItem.update({
        where: { id: itemId },
        data: { unitPrice: product.lastPrice, lineTotal: newLineTotal },
      });

      await this.prisma.auditLog.create({
        data: {
          entityType: 'CostItem',
          entityId: itemId,
          action: 'SYNC_MASTER',
          fieldChanged: 'unitPrice',
          oldValue: String(item.unitPrice),
          newValue: String(product.lastPrice),
          userId,
          organizationId,
        },
      });

      updatedItems.push({ itemId, newUnitPrice: product.lastPrice });
    }

    const refreshedBudget =
      await this.budgetRepository.findCurrentByProject(id);
    const newVersion = await this.budgetRepository.createVersion(
      id,
      (refreshedBudget?.version ?? 0) + 1,
      refreshedBudget?.vatRate ?? 7,
      userId,
      refreshedBudget?.costItems ?? [],
    );

    return { updatedItems, newBudgetVersion: newVersion };
  }

  async getDraftPO(id: string, organizationId: string) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const currentBudget = await this.budgetRepository.findCurrentByProject(id);
    if (!currentBudget || currentBudget.status !== 'LOCKED') {
      throw new ForbiddenException(
        'Budget must be locked to generate draft PO',
      );
    }

    const grouped = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        paymentTerms: string | null;
        leadTimeDays: number | null;
        lineItems: {
          productName: string | null;
          qty: number;
          unitPrice: number;
          total: number;
        }[];
      }
    >();

    for (const item of currentBudget.costItems) {
      let supplierId = item.supplierId;
      if (!supplierId && item.productId) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        supplierId = product?.defaultSupplierId ?? null;
      }
      if (!supplierId) continue;

      if (!grouped.has(supplierId)) {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: supplierId },
        });
        grouped.set(supplierId, {
          supplierId,
          supplierName: item.supplierName ?? supplier?.name ?? '',
          paymentTerms: supplier?.paymentTerms ?? null,
          leadTimeDays: supplier?.leadTimeDays ?? null,
          lineItems: [],
        });
      }

      const po = grouped.get(supplierId)!;
      po.lineItems.push({
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        total: item.lineTotal,
      });
    }

    const purchaseOrders = Array.from(grouped.values()).map((po) => ({
      ...po,
      poTotal: po.lineItems.reduce((sum, li) => sum + li.total, 0),
    }));

    return { purchaseOrders };
  }

  async getAuditLog(
    id: string,
    organizationId: string,
    filters: {
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    },
  ) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const budgets = await this.budgetRepository.findAllByProject(id);
    const budgetIds = budgets.map((b) => b.id);

    const allCostItemIds = await this.prisma.costItem
      .findMany({
        where: { budgetId: { in: budgetIds } },
        select: { id: true },
      })
      .then((items) => items.map((i) => i.id));

    const entityIds = [id, ...budgetIds, ...allCostItemIds];

    const where: Record<string, unknown> = {
      entityId: { in: entityIds },
      organizationId,
    };

    if (filters.userId) where['userId'] = filters.userId;
    if (filters.action) where['action'] = filters.action;
    if (filters.from || filters.to) {
      where['createdAt'] = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({ ...log, userName: log.user.email })),
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
      currentPage: filters.page,
      itemsPerPage: filters.limit,
    };
  }

  private async validateAndUpsertCustomFields(
    projectId: string,
    organizationId: string,
    customFieldValues: { fieldId: string; value?: string }[],
  ): Promise<void> {
    const fieldIds = customFieldValues.map((v) => v.fieldId);
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { id: { in: fieldIds }, organizationId, isDeleted: false },
      select: { id: true },
    });

    const validIds = new Set(definitions.map((d) => d.id));
    const invalidIds = fieldIds.filter((fid) => !validIds.has(fid));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Unknown custom field IDs: ${invalidIds.join(', ')}`,
      );
    }

    await this.projectRepository.upsertCustomFieldValues(
      projectId,
      customFieldValues,
    );
  }
}
