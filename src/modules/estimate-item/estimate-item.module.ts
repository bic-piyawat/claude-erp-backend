import { Module } from '@nestjs/common';
import { EstimateItemController } from './estimate-item.controller';
import { EstimateItemService } from './estimate-item.service';
import { EstimateItemRepository } from './estimate-item.repository';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule, ProjectModule],
  controllers: [EstimateItemController],
  providers: [
    EstimateItemService,
    EstimateItemRepository,
    AuditTrailInterceptor,
  ],
  exports: [EstimateItemService, EstimateItemRepository],
})
export class EstimateItemModule {}
