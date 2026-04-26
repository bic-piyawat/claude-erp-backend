import { Module } from '@nestjs/common';
import { CostItemController } from './cost-item.controller';
import { CostItemService } from './cost-item.service';
import { CostItemRepository } from './cost-item.repository';
import { BudgetRepository } from '../budget/budget.repository';
import { AuthModule } from '../auth/auth.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [CostItemController],
  providers: [
    CostItemService,
    CostItemRepository,
    BudgetRepository,
    AuditTrailInterceptor,
  ],
  exports: [CostItemService, CostItemRepository],
})
export class CostItemModule {}
