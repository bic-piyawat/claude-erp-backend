import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BudgetRepository,
  BudgetEntity,
  CostItemEntity,
} from './budget.repository';
import { PrismaService } from '../../database/prisma.service';

export interface BudgetCompareResult {
  added: CostItemEntity[];
  removed: CostItemEntity[];
  changed: {
    itemId: string;
    productName: string | null;
    v1Price: number;
    v2Price: number;
  }[];
  gpDelta: number;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getCurrentBudget(projectId: string) {
    const budget = await this.budgetRepository.findCurrentByProject(projectId);
    if (!budget)
      throw new NotFoundException('No budget found for this project');
    return budget;
  }

  async saveNewVersion(
    projectId: string,
    userId: string,
  ): Promise<BudgetEntity> {
    const current = await this.budgetRepository.findCurrentByProject(projectId);
    if (!current)
      throw new NotFoundException('No budget found for this project');

    const nextVersion = current.version + 1;
    return this.budgetRepository.createVersion(
      projectId,
      nextVersion,
      current.vatRate,
      userId,
      current.costItems,
    );
  }

  async listVersions(projectId: string): Promise<BudgetEntity[]> {
    return this.budgetRepository.findAllByProject(projectId);
  }

  async compareVersions(
    projectId: string,
    v1Id: string,
    v2Id: string,
  ): Promise<BudgetCompareResult> {
    const [b1, b2] = await Promise.all([
      this.prisma.budget.findFirst({
        where: { id: v1Id, projectId },
        include: { costItems: { where: { isDeleted: false } } },
      }),
      this.prisma.budget.findFirst({
        where: { id: v2Id, projectId },
        include: { costItems: { where: { isDeleted: false } } },
      }),
    ]);

    if (!b1) throw new NotFoundException(`Budget version ${v1Id} not found`);
    if (!b2) throw new NotFoundException(`Budget version ${v2Id} not found`);

    const v1Items = b1.costItems as CostItemEntity[];
    const v2Items = b2.costItems as CostItemEntity[];

    const v1Map = new Map(
      v1Items.filter((i) => i.productId).map((i) => [i.productId!, i]),
    );
    const v2Map = new Map(
      v2Items.filter((i) => i.productId).map((i) => [i.productId!, i]),
    );

    const added = v2Items.filter((i) => i.productId && !v1Map.has(i.productId));
    const removed = v1Items.filter(
      (i) => i.productId && !v2Map.has(i.productId),
    );
    const changed: BudgetCompareResult['changed'] = [];

    for (const [productId, v1Item] of v1Map.entries()) {
      const v2Item = v2Map.get(productId);
      if (v2Item && v2Item.unitPrice !== v1Item.unitPrice) {
        changed.push({
          itemId: v2Item.id,
          productName: v2Item.productName,
          v1Price: v1Item.unitPrice,
          v2Price: v2Item.unitPrice,
        });
      }
    }

    const v1Total = v1Items.reduce((sum, i) => sum + i.lineTotal, 0);
    const v2Total = v2Items.reduce((sum, i) => sum + i.lineTotal, 0);
    const gpDelta = v2Total - v1Total;

    return { added, removed, changed, gpDelta };
  }

  async restoreVersion(
    projectId: string,
    versionId: string,
    userId: string,
  ): Promise<BudgetEntity> {
    const source = await this.prisma.budget.findFirst({
      where: { id: versionId, projectId },
      include: { costItems: { where: { isDeleted: false } } },
    });
    if (!source) throw new NotFoundException('Budget version not found');

    const current = await this.budgetRepository.findCurrentByProject(projectId);
    const nextVersion = current ? current.version + 1 : 1;

    return this.budgetRepository.createVersion(
      projectId,
      nextVersion,
      source.vatRate,
      userId,
      source.costItems as CostItemEntity[],
    );
  }

  async unlockBudget(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<BudgetEntity> {
    const budget = await this.budgetRepository.findById(id);
    if (!budget) throw new NotFoundException('Budget not found');

    const unlocked = await this.budgetRepository.unlockBudget(id);

    await this.prisma.auditLog.create({
      data: {
        entityType: 'Budget',
        entityId: id,
        action: 'UNLOCK',
        fieldChanged: 'status',
        oldValue: 'LOCKED',
        newValue: 'DRAFT',
        userId,
        organizationId,
      },
    });

    return unlocked;
  }

  async assertNotLocked(budgetId: string): Promise<void> {
    const budget = await this.budgetRepository.findById(budgetId);
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status === 'LOCKED') {
      throw new ForbiddenException('Budget is locked');
    }
  }
}
