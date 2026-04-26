import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
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
    status: 'ACTIVE',
    ownerId: 'u-1',
    customerId: null,
    stageId: 'stage-1',
    estimatedRevenue: 500000,
    expectedCloseDate: null,
    customerPoNumber: null,
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
    vatRate: 7,
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
    } as unknown as jest.Mocked<BudgetRepository>;

    orgSettingsService = {
      getSettings: jest.fn().mockResolvedValue({ vatRate: 7 }),
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
      costItem: {
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { findUnique: jest.fn() },
      $transaction: jest.fn(),
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
        7,
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
        service.update('proj-1', 'org-1', { status: 'CLOSED_WON' } as any),
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
    it('should soft delete an ACTIVE project', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());

      await service.delete('proj-1', 'org-1');

      expect(projectRepository.softDelete).toHaveBeenCalledWith('proj-1');
    });

    it('should throw 422 when trying to delete CLOSED_WON project', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'CLOSED_WON' }),
      );

      await expect(service.delete('proj-1', 'org-1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('transitionStage', () => {
    it('should throw 403 when MEMBER tries to move project out of CLOSED_WON', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'CLOSED_WON' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-2',
        name: 'Lead',
      });

      await expect(
        service.transitionStage('proj-1', 'org-1', 'u-1', 'MEMBER', {
          stageId: 'stage-2',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 422 when transitioning to CLOSED_WON without customerPoNumber', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'ACTIVE' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });
      (prisma.attachment.count as jest.Mock).mockResolvedValue(1);
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      await expect(
        service.transitionStage('proj-1', 'org-1', 'u-1', 'FOUNDER', {
          stageId: 'stage-cw',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw 422 when transitioning to CLOSED_WON without attachments', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'ACTIVE' }),
      );
      (prisma.stage.findFirst as jest.Mock).mockResolvedValue({
        id: 'stage-cw',
        name: 'Closed Won',
      });
      (prisma.attachment.count as jest.Mock).mockResolvedValue(0);
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      await expect(
        service.transitionStage('proj-1', 'org-1', 'u-1', 'FOUNDER', {
          stageId: 'stage-cw',
          customerPoNumber: 'PO-001',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getProfitability', () => {
    it('should return profitability calculation', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ estimatedRevenue: 500000 }),
      );
      budgetRepository.findCurrentByProject.mockResolvedValue(mockBudget());

      const result = await service.getProfitability('proj-1', 'org-1');

      expect(profitabilityService.compute).toHaveBeenCalledWith(500000, 7, []);
      expect(result.colorBand).toBe('GREEN');
    });
  });

  describe('syncMaster', () => {
    it('should throw ForbiddenException for CLOSED_WON project', async () => {
      projectRepository.findById.mockResolvedValue(
        mockProject({ status: 'CLOSED_WON' }),
      );

      await expect(service.syncMaster('proj-1', 'org-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return empty diffs when no budget', async () => {
      projectRepository.findById.mockResolvedValue(mockProject());
      budgetRepository.findCurrentByProject.mockResolvedValue(null);

      const result = await service.syncMaster('proj-1', 'org-1');

      expect(result.diffs).toHaveLength(0);
    });
  });
});
