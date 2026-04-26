import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BudgetService } from '../budget.service';
import { BudgetRepository } from '../budget.repository';
import { PrismaService } from '../../../database/prisma.service';

function mockBudget(overrides = {}) {
  return {
    id: 'budget-1',
    projectId: 'proj-1',
    version: 1,
    status: 'DRAFT' as const,
    vatRate: 7,
    lockedAt: null,
    createdBy: 'u-1',
    createdAt: new Date('2026-01-01'),
    costItems: [],
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<BudgetRepository> {
  return {
    findCurrentByProject: jest.fn(),
    findById: jest.fn(),
    findAllByProject: jest.fn(),
    createVersion: jest.fn(),
    lockBudget: jest.fn(),
    unlockBudget: jest.fn(),
  } as unknown as jest.Mocked<BudgetRepository>;
}

describe('BudgetService', () => {
  let service: BudgetService;
  let repository: jest.Mocked<BudgetRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    repository = createMockRepository();
    prisma = {
      budget: { findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: BudgetRepository, useValue: repository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
  });

  describe('getCurrentBudget', () => {
    it('should return the current budget', async () => {
      repository.findCurrentByProject.mockResolvedValue(mockBudget() as any);

      const result = await service.getCurrentBudget('proj-1');

      expect(result.projectId).toBe('proj-1');
    });

    it('should throw NotFoundException when no budget exists', async () => {
      repository.findCurrentByProject.mockResolvedValue(null);

      await expect(service.getCurrentBudget('proj-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveNewVersion', () => {
    it('should create a new version incrementing from current', async () => {
      repository.findCurrentByProject.mockResolvedValue(
        mockBudget({ version: 2 }) as any,
      );
      repository.createVersion.mockResolvedValue(
        mockBudget({ version: 3 }) as any,
      );

      const result = await service.saveNewVersion('proj-1', 'u-1');

      expect(repository.createVersion).toHaveBeenCalledWith(
        'proj-1',
        3,
        7,
        'u-1',
        [],
      );
      expect(result.version).toBe(3);
    });

    it('should throw NotFoundException when no current budget', async () => {
      repository.findCurrentByProject.mockResolvedValue(null);

      await expect(service.saveNewVersion('proj-1', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listVersions', () => {
    it('should return all versions for a project', async () => {
      repository.findAllByProject.mockResolvedValue([
        mockBudget(),
        mockBudget({ id: 'b-2', version: 2 }),
      ]);

      const result = await service.listVersions('proj-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('assertNotLocked', () => {
    it('should not throw when budget is DRAFT', async () => {
      repository.findById.mockResolvedValue(
        mockBudget({ status: 'DRAFT' }) as any,
      );

      await expect(
        service.assertNotLocked('budget-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException when budget is LOCKED', async () => {
      repository.findById.mockResolvedValue(
        mockBudget({ status: 'LOCKED' }) as any,
      );

      await expect(service.assertNotLocked('budget-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when budget does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.assertNotLocked('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlockBudget', () => {
    it('should unlock a budget and write audit log', async () => {
      repository.findById.mockResolvedValue(
        mockBudget({ status: 'LOCKED' }) as any,
      );
      repository.unlockBudget.mockResolvedValue(
        mockBudget({ status: 'DRAFT' }) as any,
      );

      const result = await service.unlockBudget('budget-1', 'u-1', 'org-1');

      expect(repository.unlockBudget).toHaveBeenCalledWith('budget-1');
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });

    it('should throw NotFoundException when budget not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.unlockBudget('bad-id', 'u-1', 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
