import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationSettingsController } from '../organization-settings.controller';
import { OrganizationSettingsService } from '../organization-settings.service';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

function mockRequest(orgId = 'org-1') {
  return {
    activeOrganizationId: orgId,
    user: { userId: 'u-1', organizationIds: [orgId], role: 'FOUNDER' },
  };
}

describe('OrganizationSettingsController', () => {
  let controller: OrganizationSettingsController;
  let service: jest.Mocked<OrganizationSettingsService>;

  beforeEach(async () => {
    service = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
    } as unknown as jest.Mocked<OrganizationSettingsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationSettingsController],
      providers: [{ provide: OrganizationSettingsService, useValue: service }],
    })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationSettingsController>(
      OrganizationSettingsController,
    );
  });

  describe('getSettings', () => {
    it('should return vatRate for the active organization', async () => {
      service.getSettings.mockResolvedValue({ vatRate: 7 });
      const req = mockRequest();

      const result = await controller.getSettings(req as any);

      expect(service.getSettings).toHaveBeenCalledWith('org-1');
      expect(result.vatRate).toBe(7);
    });
  });

  describe('updateSettings', () => {
    it('should update and return vatRate', async () => {
      service.updateSettings.mockResolvedValue({
        id: 's-1',
        organizationId: 'org-1',
        vatRate: 10,
      });
      const req = mockRequest();

      const result = await controller.updateSettings(req as any, {
        vatRate: 10,
      });

      expect(service.updateSettings).toHaveBeenCalledWith('org-1', 10);
      expect(result.vatRate).toBe(10);
    });
  });
});
