import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerRepository } from './customer.repository';
import { AuthModule } from '../auth/auth.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerRepository, AuditTrailInterceptor],
  exports: [CustomerService, CustomerRepository],
})
export class CustomerModule {}
