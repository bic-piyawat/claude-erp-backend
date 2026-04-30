import { Injectable } from '@nestjs/common';
import { Prisma, CostItemCategory } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateEstimateItemData {
  productId?: string | null;
  productName?: string | null;
  productUom?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  qty: number;
  unitPrice: number;
  vatIncluded?: boolean;
  bufferAmount?: number;
  category?: CostItemCategory;
  currency?: string;
  fxRate?: number;
}

@Injectable()
export class EstimateItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    organizationId: string,
    data: CreateEstimateItemData,
  ) {
    return this.prisma.estimateItem.create({
      data: {
        projectId,
        organizationId,
        productId: data.productId ?? undefined,
        productName: data.productName ?? undefined,
        productUom: data.productUom ?? undefined,
        supplierId: data.supplierId ?? undefined,
        supplierName: data.supplierName ?? undefined,
        qty: data.qty,
        unitPrice: data.unitPrice,
        vatIncluded: data.vatIncluded ?? true,
        bufferAmount: new Prisma.Decimal(data.bufferAmount ?? 0),
        category: data.category ?? CostItemCategory.MATERIAL,
        currency: data.currency ?? 'THB',
        fxRate: data.fxRate ?? 1,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.estimateItem.findFirst({
      where: { id, isDeleted: false },
    });
  }

  async findAllByProject(
    projectId: string,
    organizationId: string,
    filters?: { productId?: string; supplierId?: string },
  ) {
    return this.prisma.estimateItem.findMany({
      where: {
        projectId,
        organizationId,
        isDeleted: false,
        ...(filters?.productId ? { productId: filters.productId } : {}),
        ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, data: Partial<CreateEstimateItemData>) {
    return this.prisma.estimateItem.update({
      where: { id },
      data: {
        productId: data.productId ?? undefined,
        productName: data.productName ?? undefined,
        productUom: data.productUom ?? undefined,
        supplierId: data.supplierId ?? undefined,
        supplierName: data.supplierName ?? undefined,
        qty: data.qty,
        unitPrice: data.unitPrice,
        vatIncluded: data.vatIncluded,
        bufferAmount:
          data.bufferAmount !== undefined
            ? new Prisma.Decimal(data.bufferAmount)
            : undefined,
        category: data.category,
        currency: data.currency,
        fxRate: data.fxRate,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.estimateItem.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
