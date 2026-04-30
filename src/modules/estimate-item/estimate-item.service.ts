import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProjectRepository } from '../project/project.repository';
import { EstimateItemRepository } from './estimate-item.repository';
import { CreateEstimateItemDto } from './dto/create-estimate-item.dto';
import { UpdateEstimateItemDto } from './dto/update-estimate-item.dto';
import { BulkReplaceEstimateItemsDto } from './dto/bulk-replace-estimate-items.dto';
import { QueryEstimateItemDto } from './dto/query-estimate-item.dto';

interface ProductSnapshot {
  productName: string | null;
  productUom: string | null;
}

interface SupplierSnapshot {
  supplierName: string | null;
}

@Injectable()
export class EstimateItemService {
  constructor(
    private readonly estimateItemRepository: EstimateItemRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createForProject(
    projectId: string,
    dto: CreateEstimateItemDto,
    organizationId: string,
  ) {
    await this.assertProjectInOrg(projectId, organizationId);

    const productSnap = await this.resolveProduct(
      dto.productId,
      organizationId,
    );
    const supplierSnap = await this.resolveSupplier(
      dto.supplierId,
      organizationId,
    );

    return this.estimateItemRepository.create(projectId, organizationId, {
      ...dto,
      productName: dto.productName ?? productSnap.productName,
      productUom: dto.productUom ?? productSnap.productUom,
      supplierName: dto.supplierName ?? supplierSnap.supplierName,
    });
  }

  async findAllByProject(
    projectId: string,
    organizationId: string,
    query: QueryEstimateItemDto,
  ) {
    await this.assertProjectInOrg(projectId, organizationId);
    return this.estimateItemRepository.findAllByProject(
      projectId,
      organizationId,
      { productId: query.productId, supplierId: query.supplierId },
    );
  }

  async findById(itemId: string, organizationId: string) {
    const item = await this.estimateItemRepository.findById(itemId);
    if (!item || item.organizationId !== organizationId) {
      throw new NotFoundException('Estimate item not found');
    }
    return item;
  }

  async updateById(
    itemId: string,
    dto: UpdateEstimateItemDto,
    organizationId: string,
  ) {
    const existing = await this.findById(itemId, organizationId);

    let productName: string | null | undefined = dto.productName;
    let productUom: string | null | undefined = dto.productUom;
    if (dto.productId && dto.productId !== existing.productId) {
      const snap = await this.resolveProduct(dto.productId, organizationId);
      productName = dto.productName ?? snap.productName;
      productUom = dto.productUom ?? snap.productUom;
    }

    let supplierName: string | null | undefined = dto.supplierName;
    if (dto.supplierId && dto.supplierId !== existing.supplierId) {
      const snap = await this.resolveSupplier(dto.supplierId, organizationId);
      supplierName = dto.supplierName ?? snap.supplierName;
    }

    return this.estimateItemRepository.update(itemId, {
      ...dto,
      productName,
      productUom,
      supplierName,
    });
  }

  async deleteById(itemId: string, organizationId: string): Promise<void> {
    await this.findById(itemId, organizationId);
    await this.estimateItemRepository.softDelete(itemId);
  }

  async bulkReplaceForProject(
    projectId: string,
    dto: BulkReplaceEstimateItemsDto,
    organizationId: string,
  ): Promise<{
    replaced: number;
    appended: number;
    items: Awaited<ReturnType<EstimateItemRepository['findAllByProject']>>;
  }> {
    await this.assertProjectInOrg(projectId, organizationId);

    // Pre-validate all productIds and supplierIds belong to active org (batched).
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

    return this.prisma.$transaction(async (tx) => {
      let replaced = 0;
      if (dto.mode === 'replace') {
        const result = await tx.estimateItem.updateMany({
          where: { projectId, isDeleted: false },
          data: { isDeleted: true },
        });
        replaced = result.count;
      }

      for (const item of dto.items) {
        const productSnap = item.productId
          ? productSnapshots.get(item.productId)!
          : { productName: null, productUom: null };
        const supplierSnap = item.supplierId
          ? supplierSnapshots.get(item.supplierId)!
          : { supplierName: null };

        await tx.estimateItem.create({
          data: {
            projectId,
            organizationId,
            productId: item.productId ?? undefined,
            productName: item.productName ?? productSnap.productName,
            productUom: item.productUom ?? productSnap.productUom,
            supplierId: item.supplierId ?? undefined,
            supplierName: item.supplierName ?? supplierSnap.supplierName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            vatIncluded: item.vatIncluded ?? true,
            bufferAmount: item.bufferAmount ?? 0,
            category: item.category ?? 'MATERIAL',
            currency: item.currency ?? 'THB',
            fxRate: item.fxRate ?? 1,
          },
        });
      }

      const items = await tx.estimateItem.findMany({
        where: { projectId, organizationId, isDeleted: false },
        orderBy: { createdAt: 'asc' },
      });

      return { replaced, appended: dto.items.length, items };
    });
  }

  private async assertProjectInOrg(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    const project = await this.projectRepository.findById(
      projectId,
      organizationId,
    );
    if (!project) throw new NotFoundException('Project not found');
  }

  private async resolveProduct(
    productId: string | undefined,
    organizationId: string,
  ): Promise<ProductSnapshot> {
    if (!productId) return { productName: null, productUom: null };
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, isDeleted: false },
    });
    if (!product) {
      throw new BadRequestException(
        'Product does not belong to this organization',
      );
    }
    return { productName: product.name, productUom: product.uom };
  }

  private async resolveSupplier(
    supplierId: string | undefined,
    organizationId: string,
  ): Promise<SupplierSnapshot> {
    if (!supplierId) return { supplierName: null };
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, isDeleted: false },
    });
    if (!supplier) {
      throw new BadRequestException(
        'Supplier does not belong to this organization',
      );
    }
    return { supplierName: supplier.name };
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
      products.map((p) => [p.id, { productName: p.name, productUom: p.uom }]),
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
