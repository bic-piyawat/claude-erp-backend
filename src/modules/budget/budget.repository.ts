import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BudgetStatus } from '@prisma/client';

export interface BudgetEntity {
  id: string;
  projectId: string;
  version: number;
  status: BudgetStatus;
  vatRate: number;
  lockedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface CostItemEntity {
  id: string;
  budgetId: string;
  productId: string | null;
  productName: string | null;
  productUom: string | null;
  productStandardCost: number | null;
  supplierId: string | null;
  supplierName: string | null;
  qty: number;
  unitPrice: number;
  vatIncluded: boolean;
  category: string;
  currency: string;
  fxRate: number;
  landedCost: number;
  status: string;
  paymentTerms: string | null;
  leadTime: number | null;
  lineTotal: number;
}

@Injectable()
export class BudgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrentByProject(
    projectId: string,
  ): Promise<(BudgetEntity & { costItems: CostItemEntity[] }) | null> {
    const budget = await this.prisma.budget.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: {
        costItems: {
          where: { isDeleted: false },
        },
      },
    });
    return budget as (BudgetEntity & { costItems: CostItemEntity[] }) | null;
  }

  async findById(id: string): Promise<BudgetEntity | null> {
    return this.prisma.budget.findUnique({
      where: { id },
    }) as Promise<BudgetEntity | null>;
  }

  async findAllByProject(projectId: string): Promise<BudgetEntity[]> {
    return this.prisma.budget.findMany({
      where: { projectId },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        projectId: true,
        version: true,
        status: true,
        vatRate: true,
        lockedAt: true,
        createdBy: true,
        createdAt: true,
      },
    }) as Promise<BudgetEntity[]>;
  }

  async createVersion(
    projectId: string,
    version: number,
    vatRate: number,
    createdBy: string,
    costItems: CostItemEntity[],
  ): Promise<BudgetEntity> {
    return this.prisma.$transaction(async (tx) => {
      const budget = await tx.budget.create({
        data: { projectId, version, vatRate, createdBy },
      });

      if (costItems.length > 0) {
        await tx.costItem.createMany({
          data: costItems.map((item) => ({
            budgetId: budget.id,
            productId: item.productId,
            productName: item.productName,
            productUom: item.productUom,
            productStandardCost: item.productStandardCost,
            supplierId: item.supplierId,
            supplierName: item.supplierName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            vatIncluded: item.vatIncluded,
            category: item.category as any,
            currency: item.currency,
            fxRate: item.fxRate,
            landedCost: item.landedCost,
            status: item.status as any,
            paymentTerms: item.paymentTerms,
            leadTime: item.leadTime,
            lineTotal: item.lineTotal,
          })),
        });
      }

      return budget as BudgetEntity;
    });
  }

  async lockBudget(id: string): Promise<BudgetEntity> {
    return this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.LOCKED, lockedAt: new Date() },
    }) as Promise<BudgetEntity>;
  }

  async unlockBudget(id: string): Promise<BudgetEntity> {
    return this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.DRAFT, lockedAt: null },
    }) as Promise<BudgetEntity>;
  }
}
