import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectService } from '../project.service';
import { ProjectRepository } from '../project.repository';
import { BudgetRepository } from '../../budget/budget.repository';
import { OrganizationSettingsService } from '../../organization-settings/organization-settings.service';
import { ProfitabilityService } from '../profitability.service';
import { PrismaService } from '../../../database/prisma.service';

function mockProject(overrides = {}): any {
  return {
    id: 'proj-1',
    name: 'Alpha ERP',
    status: 'DRAFT',
    ownerId: 'u-1',
    customerId: null,
    stageId: 'stage-1',
    totalProjectPrice: 500000,
    expectedCloseDate: null,
    customerPoNumber: null,
    customerPoIssuedDate: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    stage: { id: 'stage-1', name: 'Lead' },
    customFieldValues: [],
    attachments: [],
    ...overrides,
  };
}

function mockBudget(overrides = {}): any {
  return {
    id: 'budget-1',
    projectId: 'proj-1',
    version: 1,
    status: 'DRAFT',
    vatRate: 0.07,
    lockedAt: null,
    createdBy: 'u-1',
    createdAt: new Date(),
    costItems: [],
    ...overrides,
  };
}

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepository: jest.Mocked<ProjectRepository>;
  let budgetRepository: jest.Mocked<BudgetRepository>;
  let orgSettingsService: jest.Mocked<OrganizationSettingsService>;
  let profitabilityService: jest.Mocked<ProfitabilityService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    projectRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      upsertCustomFieldValues: jest.fn(),
      recordStageHistory: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    budgetRepository = {
      findCurrentByProject: jest.fn(),
      findAllByProject: jest.fn(),
      createVersion: jest.fn(),
      lockBudget: jest.fn(),
      unlockBudget: jest.fn(),
    } as unknown as jest.Mocked<BudgetRepository>;

    orgSettingsService = {
      getSettings: jest.fn().mockResolvedValue({ vatRate: 0.07 }),
    } as unknown as jest.Mocked<OrganizationSettingsService>;

    profitabilityService = {
      compute: jest.fn().mockReturnValue({
        totalRevenueNet: 467289,
        totalCostNet: 0,
        grossProfit: 467289,
        grossMargin: 100,
        colorBand: 'GREEN',
      }),
    } as unknown as jest.Mocked<ProfitabilityService>;

    prisma = {
      membership: { findFirst: jest.fn() },
      stage: { findFirst: jest.fn() },
      attachment: { count: jest.fn() },
      product: { update: jest.fn() },
      project: { update: jest.fn() },
      costItem: {
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { findUnique: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: projectRepository },
        { provide: BudgetRepository, useValue: budgetRepository },
        { provide: OrganizationSettingsService, useValue: orgSettingsService },
        { provide: ProfitabilityService, useValue: profitabilityService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());

      const result = await service.findById('proj-1', 'org-1');

      expect(result.id).toBe('proj-1');
    });

    it('should throw NotFoundException when project not found', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.findById('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create project with initial budget when owner is org member', async () => {
      (prisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
      });
      projectRepository.create.mockResolvedValue({ id: 'proj-1' });
      budgetRepository.createVersion.mockResolvedValue(mockBudget());
      projectRepository.findById.mockResolvedValue(mockProject());

      const result = await service.create('org-1', 'u-1', {
        name: 'Alpha ERP',
        ownerId: 'u-1',
      });

      expect(budgetRepository.createVersion).toHaveBeenCalledWith(
        'proj-1',
        1,
        0.07,
        'u-1',
        [],
      );
      expect(result.id).toBe('proj-1');
    });

    it('should throw BadRequestException when owner is not org member', async () => {
      (prisma.membership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('org-1', 'u-1', {
          name: 'Alpha ERP',
          ownerId: 'not-a-member',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw 422 when status is in update payload', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());

      await expect(
        service.update('proj-1', 'org-1', { status: 'WON' } as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw 422 when stageId is in update payload', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());

      await expect(
        service.update('proj-1', 'org-1', { stageId: 'stage-2' } as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('delete', () => {
    it('should soft delete a DRAFT project', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());

      await service.delete('proj-1', 'org-1');

      expect(projectRepository.softDelete).toHaveBeenCalledWith('proj-1');
    });

    it('should soft delete a WON project unconditionally', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'WON' }),
      );

      await service.delete('proj-1', 'org-1');

      expect(projectRepository.softDelete).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('transitionStage', () => {
    it('should record history and update stageId for a DRAFT project', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'DRAFT', stageId: 'stage-1' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-2',
        name: 'Proposal',
      });
      projectRepository.update.mockResolvedValue(
        mockProject({ stageId: 'stage-2' }),
      );

      await service.transitionStage('proj-1', 'org-1', 'u-1', 'MEMBER', {
        stageId: 'stage-2',
      });

      expect(projectRepository.recordStageHistory).toHaveBeenCalledWith(
        'proj-1',
        'stage-1',
        'stage-2',
        'u-1',
      );
      expect(projectRepository.update).toHaveBeenCalledWith('proj-1', {
        stageId: 'stage-2',
      });
    });

    it('should record history and update stageId for a WON project regardless of status', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'WON', stageId: 'stage-cw' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-2',
        name: 'Lead',
      });
      projectRepository.update.mockResolvedValue(
        mockProject({ stageId: 'stage-2' }),
      );

      await service.transitionStage('proj-1', 'org-1', 'u-1', 'MEMBER', {
        stageId: 'stage-2',
      });

      expect(projectRepository.recordStageHistory).toHaveBeenCalledWith(
        'proj-1',
        'stage-cw',
        'stage-2',
        'u-1',
      );
      expect(projectRepository.update).toHaveBeenCalledWith('proj-1', {
        stageId: 'stage-2',
      });
    });

    it('should throw NotFoundException when target stage does not exist', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.transitionStage('proj-1', 'org-1', 'u-1', 'MEMBER', {
          stageId: 'missing-stage',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfitability', () => {
    it('should return profitability calculation', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ totalProjectPrice: 500000 }),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(mockBudget());

      const result = await service.getProfitability('proj-1', 'org-1');

      expect(profitabilityService.compute).toHaveBeenCalledWith(500000, 0.07, []);
      expect(result.colorBand).toBe('GREEN');
    });
  });

  describe('syncMaster', () => {
    it('should return empty diffs when no budget', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      const result = await service.syncMaster('proj-1', 'org-1');

      expect(result.diffs).toHaveLength(0);
    });

    it('should return empty diffs for a WON project regardless of status', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      const result = await service.syncMaster('proj-1', 'org-1');

      expect(result.diffs).toHaveLength(0);
    });
  });

  describe('create (PRJ-041)', () => {
    beforeEach(() => {
      (prisma.membership.findFirst as jest.Mock).mockResolvedValue({
        id: 'm-1',
      });
      projectRepository.create.mockResolvedValue({ id: 'proj-1' });
      budgetRepository.createVersion.mockResolvedValue(mockBudget());
      projectRepository.findById.mockResolvedValue(mockProject());
    });

    it('should create with name only and default ownerId to caller', async () => {
      await service.create('org-1', 'caller-user', { name: 'Lightweight' });

      expect(projectRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Lightweight',
          ownerId: 'caller-user',
          organizationId: 'org-1',
        }),
      );
    });
  });

  describe('updateStatus (PRJ-043)', () => {
    function projectMatchingStatus(status: string) {
      return mockProject({ status });
    }

    function costItem(overrides: Record<string, unknown> = {}) {
      return {
        id: 'ci-1',
        budgetId: 'budget-1',
        productId: 'prod-1',
        productName: 'Widget',
        productUom: null,
        productStandardCost: null,
        supplierId: null,
        supplierName: null,
        qty: 2,
        unitPrice: 100,
        vatIncluded: true,
        category: 'MATERIAL',
        currency: 'THB',
        fxRate: 1,
        landedCost: 0,
        status: 'OPEN',
        paymentTerms: null,
        leadTime: null,
        lineTotal: 200,
        ...overrides,
      };
    }

    it('should throw NotFoundException when project does not exist', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', 'org-1', 'u-1', 'PROPOSED' as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should patch status without side-effects when transitioning between non-WON states', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('DRAFT'),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'PROPOSED' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-proposal',
        name: 'Proposal',
      });

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'PROPOSED' as never,
      );

      expect(result.budgetLocked).toBe(false);
      expect(budgetRepository.lockBudget).not.toHaveBeenCalled();
      expect(budgetRepository.createVersion).not.toHaveBeenCalled();
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { status: 'PROPOSED' },
      });
      expect(result.suggestedStage).toEqual({
        id: 'stage-proposal',
        name: 'Proposal',
      });
    });

    it('should write a STATUS_CHANGE audit log entry on every transition', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('DRAFT'),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'LOST' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue(null);

      await service.updateStatus('proj-1', 'org-1', 'u-1', 'LOST' as never);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'Project',
          entityId: 'proj-1',
          action: 'STATUS_CHANGE',
          fieldChanged: 'status',
          oldValue: 'DRAFT',
          newValue: 'LOST',
          userId: 'u-1',
          organizationId: 'org-1',
        },
      });
    });

    it('should return suggestedStage=null for ON_HOLD', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('DRAFT'),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'ON_HOLD' }),
      );

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'ON_HOLD' as never,
      );

      expect(result.suggestedStage).toBeNull();
      expect(prisma.stage.findFirst).not.toHaveBeenCalled();
    });

    it('should lock budget, snapshot new DRAFT version and update product lastPrice when transitioning into WON', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('AWAITING_PO'),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudget({
          id: 'budget-1',
          version: 1,
          status: 'DRAFT',
          vatRate: 0.07,
          costItems: [costItem({ productId: 'prod-1', unitPrice: 100 })],
        }),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'WON' as never,
      );

      expect(budgetRepository.lockBudget).toHaveBeenCalledWith('budget-1');
      expect(budgetRepository.createVersion).toHaveBeenCalledWith(
        'proj-1',
        2,
        0.07,
        'u-1',
        expect.any(Array),
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: expect.objectContaining({ lastPrice: 100 }),
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.budgetLocked).toBe(true);
      expect(result.suggestedStage).toEqual({
        id: 'stage-cw',
        name: 'Closed Won',
      });
    });

    it('should write STATUS_CHANGE + BUDGET_LOCK + N PRODUCT_LASTPRICE_SYNC audit entries on transition into WON', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('AWAITING_PO'),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudget({
          id: 'budget-1',
          version: 1,
          vatRate: 0.07,
          costItems: [
            costItem({ id: 'ci-1', productId: 'prod-1', unitPrice: 100 }),
            costItem({ id: 'ci-2', productId: 'prod-2', unitPrice: 200 }),
            costItem({ id: 'ci-3', productId: null, unitPrice: 300 }),
          ],
        }),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });

      await service.updateStatus('proj-1', 'org-1', 'u-1', 'WON' as never);

      const calls = (prisma.auditLog.create as jest.Mock).mock.calls.map(
        (c) => c[0].data,
      );
      const actions = calls.map((c) => c.action);

      expect(actions).toContain('STATUS_CHANGE');
      expect(actions).toContain('BUDGET_LOCK');
      expect(
        actions.filter((a) => a === 'PRODUCT_LASTPRICE_SYNC'),
      ).toHaveLength(2);
    });

    it('should be idempotent on WON -> WON (no second lock or snapshot)', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('WON'),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'WON' as never,
      );

      expect(budgetRepository.lockBudget).not.toHaveBeenCalled();
      expect(budgetRepository.createVersion).not.toHaveBeenCalled();
      expect(result.budgetLocked).toBe(false);
    });

    it('should not auto-unlock when transitioning out of WON', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('WON'),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'DRAFT' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-lead',
        name: 'Lead',
      });

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'DRAFT' as never,
      );

      expect(budgetRepository.unlockBudget).not.toHaveBeenCalled();
      expect(result.budgetLocked).toBe(false);
    });

    it('should patch status with no lock work when no current budget exists', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('DRAFT'),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(null);
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'WON' as never,
      );

      expect(budgetRepository.lockBudget).not.toHaveBeenCalled();
      expect(budgetRepository.createVersion).not.toHaveBeenCalled();
      expect(result.budgetLocked).toBe(false);
    });

    it('should be idempotent when current budget is already LOCKED', async () => {
      projectRepository.findById.mockResolvedValue(
        projectMatchingStatus('AWAITING_PO'),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(
        mockBudget({ id: 'budget-1', status: 'LOCKED' }),
      );
      (prisma.project.update as jest.Mock).mockResolvedValue(
        mockProject({ status: 'WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.updateStatus(
        'proj-1',
        'org-1',
        'u-1',
        'WON' as never,
      );

      expect(budgetRepository.lockBudget).not.toHaveBeenCalled();
      expect(budgetRepository.createVersion).not.toHaveBeenCalled();
      expect(result.budgetLocked).toBe(false);
    });

    it('should map suggestedStage per status -> stage name table', async () => {
      const cases: Array<{ status: string; expected: string | null }> = [
        { status: 'DRAFT', expected: 'Lead' },
        { status: 'PROPOSED', expected: 'Proposal' },
        { status: 'QUOTATION_SENT', expected: 'Proposal' },
        { status: 'UNDER_NEGOTIATION', expected: 'Negotiation' },
        { status: 'AWAITING_PO', expected: 'Negotiation' },
        { status: 'LOST', expected: 'Closed Lost' },
      ];

      for (const c of cases) {
        (prisma.stage.findFirst as jest.Mock).mockResolvedValueOnce({
          id: `stage-${c.status}`,
          name: c.expected,
        });
        projectRepository.findById.mockResolvedValueOnce(
          projectMatchingStatus('DRAFT'),
        );
        (prisma.project.update as jest.Mock).mockResolvedValueOnce(
          mockProject({ status: c.status }),
        );

        const result = await service.updateStatus(
          'proj-1',
          'org-1',
          'u-1',
          c.status as never,
        );

        expect((prisma.stage.findFirst as jest.Mock).mock.calls.pop()).toEqual([
          {
            where: { name: c.expected, organizationId: 'org-1' },
            select: { id: true, name: true },
          },
        ]);
        expect(result.suggestedStage?.name).toBe(c.expected);
      }
    });
  });
});
