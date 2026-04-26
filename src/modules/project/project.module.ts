import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { ProfitabilityService } from './profitability.service';
import { BudgetRepository } from '../budget/budget.repository';
import { OrganizationSettingsModule } from '../organization-settings/organization-settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, OrganizationSettingsModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectRepository,
    ProfitabilityService,
    BudgetRepository,
  ],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
