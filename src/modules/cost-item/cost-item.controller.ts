import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { CostItemService } from './cost-item.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';

@ApiTags('cost-items')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('budget/:budgetId/items')
export class CostItemController {
  constructor(private readonly costItemService: CostItemService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('budgetId') budgetId: string,
    @Body() dto: CreateCostItemDto,
  ) {
    return this.costItemService.create(
      budgetId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Patch(':itemId')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('budgetId') budgetId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCostItemDto,
  ) {
    return this.costItemService.update(budgetId, itemId, dto);
  }

  @Delete(':itemId')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('budgetId') budgetId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.costItemService.delete(budgetId, itemId);
  }
}
