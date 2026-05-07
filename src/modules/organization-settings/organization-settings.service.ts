import { Injectable } from '@nestjs/common';
import {
  OrganizationSettingsRepository,
  OrganizationSettingsEntity,
} from './organization-settings.repository';
import { VAT } from '../../common/constants/vat.constant';

@Injectable()
export class OrganizationSettingsService {
  constructor(
    private readonly organizationSettingsRepository: OrganizationSettingsRepository,
  ) {}

  async getSettings(organizationId: string): Promise<{ vatRate: number }> {
    const settings =
      await this.organizationSettingsRepository.findByOrganizationId(
        organizationId,
      );
    return { vatRate: settings?.vatRate ?? VAT.DEFAULT_RATE };
  }

  async updateSettings(
    organizationId: string,
    vatRate: number,
  ): Promise<OrganizationSettingsEntity> {
    return this.organizationSettingsRepository.upsert(organizationId, vatRate);
  }
}
