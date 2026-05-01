import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CostItemCategory, CostItemStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CostItemRepository } from './cost-item.repository';
import { BudgetRepository } from '../budget/budget.repository';
import { BudgetService } from '../budget/budget.service';
import { ProjectRepository } from '../project/project.repository';
import {
  ProfitabilityResult,
  ProfitabilityService,
} from '../project/profitability.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';
import { BulkReplaceCostItemsDto } from './dto/bulk-replace-cost-items.dto';

interface ProductSnapshot {
  productName: string | null;
  productUom: string | null;
  productStandardCost: number | null;
}

interface SupplierSnapshot {
  supplierName: string | null;
}

@Injectable()
export class CostItemService {
  constructor(
    private readonly costItemRepository: CostItemRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetService: BudgetService,
    private readonly projectRepository: ProjectRepository,
    private readonly profitabilityService: ProfitabilityService,
    private readonly prisma: PrismaService,
  ) {}

  computeLineTotal(qty: number, unitPrice: number): number {
    return qty * unitPrice;
  }

  async create(
    budgetId: string,
    dto: CreateCostItemDto,
    organizationId: string,
  ) {
    const budget = await this.budgetRepository.findById(budgetId);
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status === 'LOCKED')
      throw new ForbiddenException('Budget is locked');

    let productName: string | null = null;
    let productUom: string | null = null;
    let productStandardCost: number | null = null;
    let supplierName: string | null = null;

    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, organizationId, isDeleted: false },
      });
      if (!product)
        throw new ForbiddenException(
          'Product does not belong to this organization',
        );
      productName = product.name;
      productUom = product.uom;
      productStandardCost = product.standardCost;
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId, isDeleted: false },
      });
      if (!supplier)
        throw new ForbiddenException(
          'Supplier does not belong to this organization',
        );
      supplierName = supplier.name;
    }

    const lineTotal = this.computeLineTotal(dto.qty, dto.unitPrice);

    return this.costItemRepository.create(budgetId, {
      ...dto,
      productName,
      productUom,
      productStandardCost,
      supplierName,
      lineTotal,
    });
  }

  async update(budgetId: string, itemId: string, dto: UpdateCostItemDto) {
    const budget = await this.budgetRepository.findById(budgetId);
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status === 'LOCKED')
      throw new ForbiddenException('Budget is locked');

    const item = await this.costItemRepository.findById(itemId);
    if (!item || item.budgetId !== budgetId)
      throw new NotFoundException('Cost item not found');

    const qty = dto.qty ?? item.qty;
    const unitPrice = dto.unitPrice ?? item.unitPrice;
    const lineTotal = this.computeLineTotal(qty, unitPrice);

    return this.costItemRepository.update(itemId, { ...dto, lineTotal });
  }

  async delete(budgetId: string, itemId: string): Promise<void> {
    const budget = await this.budgetRepository.findById(budgetId);
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status === 'LOCKED')
      throw new ForbiddenException('Budget is locked');

    const item = await this.costItemRepository.findById(itemId);
    if (!item || item.budgetId !== budgetId)
      throw new NotFoundException('Cost item not found');

    await this.costItemRepository.softDelete(itemId);
  }

  async createForProject(
    projectId: string,
    dto: CreateCostItemDto,
    organizationId: string,
  ) {
    await this.assertProjectInOrg(projectId, organizationId);
    const budget = await this.budgetRepository.findCurrentByProject(projectId);
    if (!budget)
      throw new NotFoundException('No budget found for this project');

    return this.create(budget.id, dto, organizationId);
  }

  async findAllByProject(projectId: string, organizationId: string) {
    await this.assertProjectInOrg(projectId, organizationId);
    const budget = await this.budgetRepository.findCurrentByProject(projectId);
    if (!budget) return [];
    return this.costItemRepository.findAllByBudget(budget.id);
  }

  async updateById(
    itemId: string,
    dto: UpdateCostItemDto,
    organizationId: string,
  ) {
    const { item, budgetId } = await this.loadItemForOrg(
      itemId,
      organizationId,
    );
    return this.update(budgetId, item.id, dto);
  }

  async deleteById(itemId: string, organizationId: string): Promise<void> {
    const { item, budgetId } = await this.loadItemForOrg(
      itemId,
      organizationId,
    );
    await this.delete(budgetId, item.id);
  }

  async bulkReplaceForProject(
    projectId: string,
    dto: BulkReplaceCostItemsDto,
    organizationId: string,
    userId: string,
  ): Promise<{
    replaced: number;
    appended: number;
    profitability: ProfitabilityResult;
  }> {
    const project = await this.assertProjectInOrg(projectId, organizationId);
    const budget = await this.budgetRepository.findCurrentByProject(projectId);
    if (!budget)
      throw new NotFoundException('No budget found for this project');

    await this.budgetService.assertNotLocked(budget.id);

    // Pre-validate every productId/supplierId belongs to active org BEFORE the
    // transaction, so we throw 400 cleanly without partial writes.
    const productIds = Array.from(
      new Set(
        dto.items.map((i) => i.productId).filter((v): v is string => !!v),
      ),
    );
    const supplierIds = Array.from(
      new Set(
        dto.items.map((i) => i.supplierId).filter((v): v is string => !!v),
      ),
    );
    const productSnapshots = await this.batchResolveProducts(
      productIds,
      organizationId,
    );
    const supplierSnapshots = await this.batchResolveSuppliers(
      supplierIds,
      organizationId,
    );

    const { replaced, appended } = await this.prisma.$transaction(
      async (tx) => {
        let replacedCount = 0;
        const previousActive = await tx.costItem.findMany({
          where: { budgetId: budget.id, isDeleted: false },
          select: { id: true },
        });

        if (dto.mode === 'replace') {
          const result = await tx.costItem.updateMany({
            where: { budgetId: budget.id, isDeleted: false },
            data: { isDeleted: true },
          });
          replacedCount = result.count;

          // Audit per soft-deleted row.
          for (const removed of previousActive) {
            await tx.auditLog.create({
              data: {
                entityType: 'CostItem',
                entityId: removed.id,
                action: 'BULK_REPLACE',
                fieldChanged: 'isDeleted',
                oldValue: 'false',
                newValue: 'true',
                userId,
                organizationId,
              },
            });
          }
        }

        for (const item of dto.items) {
          const productSnap = item.productId
            ? productSnapshots.get(item.productId)!
            : {
                productName: null,
                productUom: null,
                productStandardCost: null,
              };
          const supplierSnap = item.supplierId
            ? supplierSnapshots.get(item.supplierId)!
            : { supplierName: null };

          const lineTotal = this.computeLineTotal(item.qty, item.unitPrice);

          const created = await tx.costItem.create({
            data: {
              budgetId: budget.id,
              productId: item.productId,
              productName: productSnap.productName,
              productUom: productSnap.productUom,
              productStandardCost: productSnap.productStandardCost,
              supplierId: item.supplierId,
              supplierName: supplierSnap.supplierName,
              qty: item.qty,
              unitPrice: item.unitPrice,
              vatIncluded: item.vatIncluded ?? true,
              category: (item.category ?? 'MATERIAL') as CostItemCategory,
              currency: item.currency ?? 'THB',
              fxRate: item.fxRate ?? 1,
              landedCost: item.landedCost ?? 0,
              status: (item.status ?? 'QUOTED') as CostItemStatus,
              paymentTerms: item.paymentTerms,
              leadTime: item.leadTime,
              lineTotal,
            },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'CostItem',
              entityId: created.id,
              action: 'BULK_REPLACE',
              fieldChanged: 'created',
              oldValue: null,
              newValue: JSON.stringify({
                qty: item.qty,
                unitPrice: item.unitPrice,
                productId: item.productId ?? null,
                supplierId: item.supplierId ?? null,
              }),
              userId,
              organizationId,
            },
          });
        }

        return { replaced: replacedCount, appended: dto.items.length };
      },
    );

    // Recompute profitability post-transaction against the new item set.
    const refreshed =
      await this.budgetRepository.findCurrentByProject(projectId);
    const profitability = this.profitabilityService.compute(
      project.totalProjectPrice ?? 0,
      refreshed?.vatRate ?? budget.vatRate,
      (refreshed?.costItems ?? []).map((i) => ({
        lineTotal: i.lineTotal,
        vatIncluded: i.vatIncluded,
      })),
    );

    return { replaced, appended, profitability };
  }

  private async assertProjectInOrg(projectId: string, organizationId: string) {
    const project = await this.projectRepository.findById(
      projectId,
      organizationId,
    );
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async loadItemForOrg(itemId: string, organizationId: string) {
    const item = await this.costItemRepository.findById(itemId);
    if (!item) throw new NotFoundException('Cost item not found');

    const budget = await this.budgetRepository.findById(item.budgetId);
    if (!budget) throw new NotFoundException('Cost item not found');

    const project = await this.projectRepository.findById(
      budget.projectId,
      organizationId,
    );
    if (!project) throw new NotFoundException('Cost item not found');

    return { item, budgetId: budget.id };
  }

  private async batchResolveProducts(
    productIds: string[],
    organizationId: string,
  ): Promise<Map<string, ProductSnapshot>> {
    if (productIds.length === 0) return new Map();
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId, isDeleted: false },
    });
    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Product(s) not in active organization: ${missing.join(', ')}`,
      );
    }
    return new Map(
      products.map((p) => [
        p.id,
        {
          productName: p.name,
          productUom: p.uom,
          productStandardCost: p.standardCost,
        },
      ]),
    );
  }

  private async batchResolveSuppliers(
    supplierIds: string[],
    organizationId: string,
  ): Promise<Map<string, SupplierSnapshot>> {
    if (supplierIds.length === 0) return new Map();
    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds }, organizationId, isDeleted: false },
    });
    const found = new Set(suppliers.map((s) => s.id));
    const missing = supplierIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Supplier(s) not in active organization: ${missing.join(', ')}`,
      );
    }
    return new Map(suppliers.map((s) => [s.id, { supplierName: s.name }]));
  }
}
