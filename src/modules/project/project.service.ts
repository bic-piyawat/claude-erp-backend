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
import { ProjectSortField } from './dto/query-project.dto';
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
import { ProjectStatus, BudgetStatus } from '@prisma/client';
import { BUSINESS_RULE_ERROR_CODE } from '../../common/constants/business-rule-error-code.constant';
import { AUDIT_ACTION } from '../../common/constants/audit-action.constant';
import { VAT } from '../../common/constants/vat.constant';
import { STAGE_SUGGESTION_BY_STATUS } from '../../common/constants/stage-name.constant';


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
    customerId?: string,
    sortBy?: ProjectSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<PaginatedResult<ProjectListItem>> {
    return this.projectRepository.findAll(
      organizationId,
      search,
      stageId,
      ownerId,
      page,
      limit,
      customerId,
      sortBy,
      sortDir,
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
      totalProjectPrice: dto.totalProjectPrice,
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
          code: BUSINESS_RULE_ERROR_CODE.BUSINESS_RULE_VIOLATION,
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

    await this.projectRepository.softDelete(id);
  }

  async transitionStage(
    id: string,
    organizationId: string,
    userId: string,
    _userRole: string | undefined,
    dto: StageTransitionDto,
  ): Promise<ProjectDetail> {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const targetStage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, organizationId, isDeleted: false },
    });
    if (!targetStage) throw new NotFoundException('Target stage not found');

    await this.projectRepository.recordStageHistory(
      id,
      project.stageId,
      dto.stageId,
      userId,
    );
    return this.projectRepository.update(id, { stageId: dto.stageId });
  }

  async updateStatus(
    projectId: string,
    organizationId: string,
    userId: string,
    newStatus: ProjectStatus,
  ): Promise<{
    project: ProjectDetail;
    suggestedStage: { id: string; name: string } | null;
    budgetLocked: boolean;
  }> {
    const project = await this.projectRepository.findById(
      projectId,
      organizationId,
    );
    if (!project) throw new NotFoundException('Project not found');

    const prevStatus = project.status;
    const isTransitioningIntoWon =
      newStatus === ProjectStatus.WON && prevStatus !== ProjectStatus.WON;

    let budgetLocked = false;
    if (isTransitioningIntoWon) {
      budgetLocked = await this.applyWonSideEffects(
        projectId,
        organizationId,
        userId,
      );
    }

    // Bypass the routing-rule guard in `repository.update` (which 422s on `status` payload)
    // by writing directly via Prisma. The /status endpoint is the legitimate path for status mutations.
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: newStatus },
    });

    const updated = (await this.projectRepository.findById(
      projectId,
      organizationId,
    )) as ProjectDetail;

    // Manual STATUS_CHANGE audit entry (separate from the generic PATCH the interceptor records).
    await this.prisma.auditLog.create({
      data: {
        entityType: 'Project',
        entityId: projectId,
        action: AUDIT_ACTION.STATUS_CHANGE,
        fieldChanged: 'status',
        oldValue: prevStatus,
        newValue: newStatus,
        userId,
        organizationId,
      },
    });

    const suggestedStage = await this.suggestStageForStatus(
      newStatus,
      organizationId,
    );

    return { project: updated, suggestedStage, budgetLocked };
  }

  private async applyWonSideEffects(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const currentBudget =
      await this.budgetRepository.findCurrentByProject(projectId);
    if (!currentBudget) return false;
    if (currentBudget.status !== BudgetStatus.DRAFT) return false; // already locked → idempotent no-op

    await this.budgetRepository.lockBudget(currentBudget.id);

    // Snapshot a new DRAFT version so re-quote editing remains possible
    // (matches the deleted Wave-0 closed-won behaviour — see git show 0c5bfbd).
    const nextVersion = currentBudget.version + 1;
    await this.budgetRepository.createVersion(
      projectId,
      nextVersion,
      currentBudget.vatRate,
      userId,
      currentBudget.costItems,
    );

    const productItems = currentBudget.costItems.filter(
      (item) => item.productId && item.unitPrice,
    );

    if (productItems.length > 0) {
      await this.prisma.$transaction(
        productItems.map((item) =>
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

    // Side-effect audit entries (separate from the STATUS_CHANGE entry written by the caller).
    const sideEffectLogs: Promise<unknown>[] = [
      this.prisma.auditLog.create({
        data: {
          entityType: 'Budget',
          entityId: currentBudget.id,
          action: AUDIT_ACTION.BUDGET_LOCK,
          fieldChanged: 'status',
          oldValue: 'DRAFT',
          newValue: 'LOCKED',
          userId,
          organizationId,
        },
      }),
      ...productItems.map((item) =>
        this.prisma.auditLog.create({
          data: {
            entityType: 'Product',
            entityId: item.productId!,
            action: AUDIT_ACTION.PRODUCT_LASTPRICE_SYNC,
            fieldChanged: 'lastPrice',
            oldValue: null,
            newValue: String(item.unitPrice),
            userId,
            organizationId,
          },
        }),
      ),
    ];
    await Promise.all(sideEffectLogs);

    return true;
  }

  private async suggestStageForStatus(
    status: ProjectStatus,
    organizationId: string,
  ): Promise<{ id: string; name: string } | null> {
    const targetName = STAGE_SUGGESTION_BY_STATUS[status];
    if (!targetName) return null;
    const stage = await this.prisma.stage.findFirst({
      where: { name: targetName, organizationId },
      select: { id: true, name: true },
    });
    return stage;
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
      project.totalProjectPrice ?? 0,
      settings.vatRate,
      costItems,
    );
  }

  async syncMaster(id: string, organizationId: string) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

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

      const newLineTotal = item.qty * product.lastPrice;
      await this.prisma.costItem.update({
        where: { id: itemId },
        data: { unitPrice: product.lastPrice, lineTotal: newLineTotal },
      });

      await this.prisma.auditLog.create({
        data: {
          entityType: 'CostItem',
          entityId: itemId,
          action: AUDIT_ACTION.SYNC_MASTER,
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
      refreshedBudget?.vatRate ?? VAT.DEFAULT_RATE,
      userId,
      refreshedBudget?.costItems ?? [],
    );

    return { updatedItems, newBudgetVersion: newVersion };
  }

  async getDraftPO(id: string, organizationId: string) {
    const project = await this.projectRepository.findById(id, organizationId);
    if (!project) throw new NotFoundException('Project not found');

    const currentBudget = await this.budgetRepository.findCurrentByProject(id);
    if (!currentBudget || currentBudget.status !== BudgetStatus.LOCKED) {
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
