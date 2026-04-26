import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { StageService } from '../stage.service';
import { StageRepository } from '../stage.repository';

function mockStage(overrides = {}) {
  return {
    id: 'stage-1',
    name: 'Lead',
    order: 1,
    isStandard: false,
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<StageRepository> {
  return {
    findAllByOrganization: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    hasActiveProjects: jest.fn(),
    reorder: jest.fn(),
  } as unknown as jest.Mocked<StageRepository>;
}

describe('StageService', () => {
  let service: StageService;
  let repository: jest.Mocked<StageRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StageService,
        { provide: StageRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<StageService>(StageService);
  });

  describe('findAll', () => {
    it('should return all stages for an organization', async () => {
      repository.findAllByOrganization.mockResolvedValue([mockStage()]);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lead');
    });
  });

  describe('create', () => {
    it('should create and return a new stage', async () => {
      repository.create.mockResolvedValue(
        mockStage({ name: 'Proposal', order: 2 }),
      );

      const result = await service.create('org-1', 'Proposal', 2);

      expect(repository.create).toHaveBeenCalledWith('org-1', 'Proposal', 2);
      expect(result.name).toBe('Proposal');
    });
  });

  describe('update', () => {
    it('should update and return the stage', async () => {
      repository.findById.mockResolvedValue(mockStage());
      repository.update.mockResolvedValue(mockStage({ name: 'Updated' }));

      const result = await service.update('stage-1', 'org-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when stage does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', 'org-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a stage with no active projects', async () => {
      repository.findById.mockResolvedValue(mockStage());
      repository.hasActiveProjects.mockResolvedValue(false);

      await service.delete('stage-1', 'org-1');

      expect(repository.softDelete).toHaveBeenCalledWith('stage-1');
    });

    it('should throw 422 when stage has active projects', async () => {
      repository.findById.mockResolvedValue(mockStage());
      repository.hasActiveProjects.mockResolvedValue(true);

      await expect(service.delete('stage-1', 'org-1')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw NotFoundException when stage does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('should reorder stages when all ids are valid', async () => {
      repository.findById.mockResolvedValue(mockStage());
      repository.reorder.mockResolvedValue(undefined);

      await service.reorder('org-1', [{ id: 'stage-1', order: 2 }]);

      expect(repository.reorder).toHaveBeenCalledWith([
        { id: 'stage-1', order: 2 },
      ]);
    });

    it('should throw NotFoundException when a stage id is invalid', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.reorder('org-1', [{ id: 'bad-id', order: 1 }]),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
