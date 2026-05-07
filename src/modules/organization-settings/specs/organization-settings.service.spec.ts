import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationSettingsService } from '../organization-settings.service';
import { OrganizationSettingsRepository } from '../organization-settings.repository';

function createMockRepository(): jest.Mocked<OrganizationSettingsRepository> {
  return {
    findByOrganizationId: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<OrganizationSettingsRepository>;
}

describe('OrganizationSettingsService', () => {
  let service: OrganizationSettingsService;
  let repository: jest.Mocked<OrganizationSettingsRepository>;

  beforeEach(async () => {
    repository = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationSettingsService,
        { provide: OrganizationSettingsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<OrganizationSettingsService>(
      OrganizationSettingsService,
    );
  });

  describe('getSettings', () => {
    it('should return vatRate from existing settings', async () => {
      repository.findByOrganizationId.mockResolvedValue({
        id: 's-1',
        organizationId: 'org-1',
        vatRate: 10,
      });

      const result = await service.getSettings('org-1');

      expect(result.vatRate).toBe(10);
    });

    it('should return default vatRate of 0.07 when settings do not exist', async () => {
      repository.findByOrganizationId.mockResolvedValue(null);

      const result = await service.getSettings('org-1');

      expect(result.vatRate).toBe(0.07);
    });
  });

  describe('updateSettings', () => {
    it('should call upsert with the correct organizationId and vatRate', async () => {
      const expected = { id: 's-1', organizationId: 'org-1', vatRate: 15 };
      repository.upsert.mockResolvedValue(expected);

      const result = await service.updateSettings('org-1', 15);

      expect(repository.upsert).toHaveBeenCalledWith('org-1', 15);
      expect(result.vatRate).toBe(15);
    });
  });
});
