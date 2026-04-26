import { Module } from '@nestjs/common';
import { CustomFieldController } from './custom-field.controller';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldRepository } from './custom-field.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CustomFieldController],
  providers: [CustomFieldService, CustomFieldRepository],
  exports: [CustomFieldService, CustomFieldRepository],
})
export class CustomFieldModule {}
