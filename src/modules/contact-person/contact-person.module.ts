import { Module } from '@nestjs/common';
import { ContactPersonController } from './contact-person.controller';
import { ContactPersonService } from './contact-person.service';
import { ContactPersonRepository } from './contact-person.repository';
import { AuthModule } from '../auth/auth.module';
import { CustomerModule } from '../customer/customer.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule, CustomerModule],
  controllers: [ContactPersonController],
  providers: [
    ContactPersonService,
    ContactPersonRepository,
    AuditTrailInterceptor,
  ],
  exports: [ContactPersonService, ContactPersonRepository],
})
export class ContactPersonModule {}
