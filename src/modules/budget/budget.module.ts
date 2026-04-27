import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetRepository } from './budget.repository';
import { AuthModule } from '../auth/auth.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetRepository, AuditTrailInterceptor],
  exports: [BudgetService, BudgetRepository],
})
export class BudgetModule {}
