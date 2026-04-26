import { Test, TestingModule } from '@nestjs/testing';
import { StageController } from '../stage.controller';
import { StageService } from '../stage.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId], role: 'FOUNDER' },
  };
}

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

describe('StageController', () => {
  let controller: StageController;
  let service: jest.Mocked<StageService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    } as unknown as jest.Mocked<StageService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StageController],
      providers: [{ provide: StageService, useValue: service }],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StageController>(StageController);
  });

  it('should return stages from findAll', async () => {
    service.findAll.mockResolvedValue([mockStage()]);
    const req = mockRequest();

    const result = await controller.findAll(req as any);

    expect(result).toHaveLength(1);
  });

  it('should create a stage', async () => {
    service.create.mockResolvedValue(mockStage({ name: 'New Stage' }));
    const req = mockRequest();

    const result = await controller.create(req as any, {
      name: 'New Stage',
      order: 2,
    });

    expect(service.create).toHaveBeenCalledWith('org-1', 'New Stage', 2);
    expect(result.name).toBe('New Stage');
  });

  it('should update a stage', async () => {
    service.update.mockResolvedValue(mockStage({ name: 'Updated' }));
    const req = mockRequest();

    const result = await controller.update(req as any, 'stage-1', {
      name: 'Updated',
    });

    expect(result.name).toBe('Updated');
  });

  it('should delete a stage with no content', async () => {
    service.delete.mockResolvedValue(undefined);
    const req = mockRequest();

    await controller.delete(req as any, 'stage-1');

    expect(service.delete).toHaveBeenCalledWith('stage-1', 'org-1');
  });

  it('should reorder stages', async () => {
    service.reorder.mockResolvedValue(undefined);
    const req = mockRequest();

    const result = await controller.reorder(req as any, {
      stages: [{ id: 'stage-1', order: 2 }],
    });

    expect(result).toEqual({ reordered: true });
  });
});
