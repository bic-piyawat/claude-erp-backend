import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationSettingsModule } from './modules/organization-settings/organization-settings.module';
import { StageModule } from './modules/stage/stage.module';
import { CustomerModule } from './modules/customer/customer.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { ProductModule } from './modules/product/product.module';
import { BudgetModule } from './modules/budget/budget.module';
import { CostItemModule } from './modules/cost-item/cost-item.module';
import { ProjectModule } from './modules/project/project.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { CustomFieldModule } from './modules/custom-field/custom-field.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    OrganizationSettingsModule,
    StageModule,
    CustomerModule,
    SupplierModule,
    ProductModule,
    BudgetModule,
    CostItemModule,
    ProjectModule,
    AttachmentModule,
    CustomFieldModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
