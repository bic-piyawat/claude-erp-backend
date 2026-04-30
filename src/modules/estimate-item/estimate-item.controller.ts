import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { EstimateItemService } from './estimate-item.service';
import { CreateEstimateItemDto } from './dto/create-estimate-item.dto';
import { UpdateEstimateItemDto } from './dto/update-estimate-item.dto';
import { BulkReplaceEstimateItemsDto } from './dto/bulk-replace-estimate-items.dto';
import { QueryEstimateItemDto } from './dto/query-estimate-item.dto';

@ApiTags('estimate-items')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@UseInterceptors(AuditTrailInterceptor)
@Controller()
export class EstimateItemController {
  constructor(private readonly estimateItemService: EstimateItemService) {}

  @Post('projects/:projectId/estimate-items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an estimate item to a project' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEstimateItemDto,
  ) {
    return this.estimateItemService.createForProject(
      projectId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Get('projects/:projectId/estimate-items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List estimate items for a project' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query() query: QueryEstimateItemDto,
  ) {
    return this.estimateItemService.findAllByProject(
      projectId,
      req.activeOrganizationId!,
      query,
    );
  }

  @Patch('estimate-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an estimate item' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateEstimateItemDto,
  ) {
    return this.estimateItemService.updateById(
      itemId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Delete('estimate-items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an estimate item' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    await this.estimateItemService.deleteById(
      itemId,
      req.activeOrganizationId!,
    );
  }

  @Post('projects/:projectId/estimate-items/bulk-replace')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk replace or append estimate items' })
  async bulkReplace(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: BulkReplaceEstimateItemsDto,
  ) {
    return this.estimateItemService.bulkReplaceForProject(
      projectId,
      dto,
      req.activeOrganizationId!,
    );
  }
}
