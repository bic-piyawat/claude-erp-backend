import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CostItemRepository } from './cost-item.repository';
import { BudgetRepository } from '../budget/budget.repository';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';

@Injectable()
export class CostItemService {
  constructor(
    private readonly costItemRepository: CostItemRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly prisma: PrismaService,
  ) {}

  computeLineTotal(
    qty: number,
    unitPrice: number,
    safetyBufferPercent: number,
  ): number {
    return qty * unitPrice * (1 + safetyBufferPercent / 100);
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

    const lineTotal = this.computeLineTotal(
      dto.qty,
      dto.unitPrice,
      dto.safetyBufferPercent ?? 0,
    );

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
    const safetyBufferPercent =
      dto.safetyBufferPercent ?? item.safetyBufferPercent;
    const lineTotal = this.computeLineTotal(
      qty,
      unitPrice,
      safetyBufferPercent,
    );

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
}
