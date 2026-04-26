import { Module } from '@nestjs/common';
import { StageController } from './stage.controller';
import { StageService } from './stage.service';
import { StageRepository } from './stage.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StageController],
  providers: [StageService, StageRepository],
  exports: [StageService, StageRepository],
})
export class StageModule {}
