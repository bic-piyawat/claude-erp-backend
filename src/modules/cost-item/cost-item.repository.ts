import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CostItemCategory, CostItemStatus } from '@prisma/client';

export interface CreateCostItemData {
  productId?: string;
  productName?: string | null;
  productUom?: string | null;
  productStandardCost?: number | null;
  supplierId?: string;
  supplierName?: string | null;
  qty: number;
  unitPrice: number;
  vatIncluded?: boolean;
  safetyBufferPercent?: number;
  category?: string;
  currency?: string;
  fxRate?: number;
  landedCost?: number;
  status?: string;
  paymentTerms?: string;
  leadTime?: number;
  lineTotal: number;
}

@Injectable()
export class CostItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(budgetId: string, data: CreateCostItemData) {
    return this.prisma.costItem.create({
      data: {
        budgetId,
        productId: data.productId,
        productName: data.productName,
        productUom: data.productUom,
        productStandardCost: data.productStandardCost,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        qty: data.qty,
        unitPrice: data.unitPrice,
        vatIncluded: data.vatIncluded ?? true,
        safetyBufferPercent: data.safetyBufferPercent ?? 0,
        category: (data.category ?? 'MATERIAL') as CostItemCategory,
        currency: data.currency ?? 'THB',
        fxRate: data.fxRate ?? 1,
        landedCost: data.landedCost ?? 0,
        status: (data.status ?? 'QUOTED') as CostItemStatus,
        paymentTerms: data.paymentTerms,
        leadTime: data.leadTime,
        lineTotal: data.lineTotal,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.costItem.findFirst({ where: { id, isDeleted: false } });
  }

  async update(id: string, data: Partial<CreateCostItemData>) {
    return this.prisma.costItem.update({
      where: { id },
      data: {
        ...data,
        category: data.category
          ? (data.category as CostItemCategory)
          : undefined,
        status: data.status ? (data.status as CostItemStatus) : undefined,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.costItem.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
