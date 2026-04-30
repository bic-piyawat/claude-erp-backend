import { Module } from '@nestjs/common';
import { CostItemController } from './cost-item.controller';
import { ProjectCostItemController } from './project-cost-item.controller';
import { CostItemService } from './cost-item.service';
import { CostItemRepository } from './cost-item.repository';
import { AuthModule } from '../auth/auth.module';
import { BudgetModule } from '../budget/budget.module';
import { ProjectModule } from '../project/project.module';
import { ProfitabilityService } from '../project/profitability.service';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule, BudgetModule, ProjectModule],
  controllers: [CostItemController, ProjectCostItemController],
  providers: [
    CostItemService,
    CostItemRepository,
    ProfitabilityService,
    AuditTrailInterceptor,
  ],
  exports: [CostItemService, CostItemRepository],
})
export class CostItemModule {}
