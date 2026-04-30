import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentRepository } from './attachment.repository';
import { AuthModule } from '../auth/auth.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentRepository, AuditTrailInterceptor],
  exports: [AttachmentService, AttachmentRepository],
})
export class AttachmentModule {}
