import { Module } from '@nestjs/common';
import { OrganizationSettingsController } from './organization-settings.controller';
import { OrganizationSettingsService } from './organization-settings.service';
import { OrganizationSettingsRepository } from './organization-settings.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationSettingsController],
  providers: [OrganizationSettingsService, OrganizationSettingsRepository],
  exports: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
