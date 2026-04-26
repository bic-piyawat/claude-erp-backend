import { Module } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { SupplierRepository } from './supplier.repository';
import { AuthModule } from '../auth/auth.module';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [SupplierController],
  providers: [SupplierService, SupplierRepository, AuditTrailInterceptor],
  exports: [SupplierService, SupplierRepository],
})
export class SupplierModule {}
