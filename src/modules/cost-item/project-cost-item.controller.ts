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
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedRequest,
  OrganizationGuard,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { CostItemService } from './cost-item.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';
import { BulkReplaceCostItemsDto } from './dto/bulk-replace-cost-items.dto';

@ApiTags('cost-items')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@UseInterceptors(AuditTrailInterceptor)
@Controller()
export class ProjectCostItemController {
  constructor(private readonly costItemService: CostItemService) {}

  @Post('projects/:projectId/cost-items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a cost item to the current Budget of a project',
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateCostItemDto,
  ) {
    return this.costItemService.createForProject(
      projectId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Post('projects/:projectId/cost-items/bulk-replace')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bulk replace or append cost items on the current Budget of a project',
  })
  async bulkReplace(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: BulkReplaceCostItemsDto,
  ) {
    return this.costItemService.bulkReplaceForProject(
      projectId,
      dto,
      req.activeOrganizationId!,
      req.user!.userId,
    );
  }

  @Patch('cost-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a cost item by id (flat alias)' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCostItemDto,
  ) {
    return this.costItemService.updateById(
      itemId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Delete('cost-items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a cost item by id (flat alias)' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    await this.costItemService.deleteById(itemId, req.activeOrganizationId!);
  }
}
