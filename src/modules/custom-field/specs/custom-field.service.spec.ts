import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomFieldService } from '../custom-field.service';
import { CustomFieldRepository } from '../custom-field.repository';

function mockField(overrides = {}) {
  return {
    id: 'cf-1',
    fieldName: 'Budget Category',
    fieldType: 'DROPDOWN' as const,
    isMandatory: false,
    placeholder: 'Select',
    defaultValue: null,
    options: '["Option A","Option B"]',
    scope: 'ALL_COMPANIES' as const,
    order: 0,
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRepository(): jest.Mocked<CustomFieldRepository> {
  return {
    findAllByOrganization: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    reorder: jest.fn(),
  } as unknown as jest.Mocked<CustomFieldRepository>;
}

describe('CustomFieldService', () => {
  let service: CustomFieldService;
  let repository: jest.Mocked<CustomFieldRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomFieldService,
        { provide: CustomFieldRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<CustomFieldService>(CustomFieldService);
  });

  describe('findAll', () => {
    it('should return all custom fields for an organization', async () => {
      repository.findAllByOrganization.mockResolvedValue([mockField()]);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe('Budget Category');
    });
  });

  describe('create', () => {
    it('should create a custom field with serialized options', async () => {
      repository.create.mockResolvedValue(mockField());

      await service.create('org-1', {
        fieldName: 'Budget Category',
        fieldType: 'DROPDOWN',
        options: ['Option A', 'Option B'],
      });

      expect(repository.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ options: '["Option A","Option B"]' }),
      );
    });
  });

  describe('update', () => {
    it('should update a custom field', async () => {
      repository.findById.mockResolvedValue(mockField());
      repository.update.mockResolvedValue(mockField({ fieldName: 'Updated' }));

      const result = await service.update('cf-1', 'org-1', {
        fieldName: 'Updated',
      });

      expect(result.fieldName).toBe('Updated');
    });

    it('should throw NotFoundException when field not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('bad-id', 'org-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a custom field', async () => {
      repository.findById.mockResolvedValue(mockField());

      await service.delete('cf-1', 'org-1');

      expect(repository.softDelete).toHaveBeenCalledWith('cf-1');
    });

    it('should throw NotFoundException when field not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('should reorder valid fields', async () => {
      repository.findById.mockResolvedValue(mockField());
      repository.reorder.mockResolvedValue(undefined);

      await service.reorder('org-1', [{ id: 'cf-1', order: 1 }]);

      expect(repository.reorder).toHaveBeenCalledWith([
        { id: 'cf-1', order: 1 },
      ]);
    });

    it('should throw NotFoundException when field id not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.reorder('org-1', [{ id: 'bad-id', order: 1 }]),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
