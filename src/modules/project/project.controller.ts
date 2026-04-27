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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { StageTransitionDto } from './dto/stage-transition.dto';
import { SyncMasterApplyDto } from './dto/sync-master-apply.dto';

@ApiTags('projects')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryProjectDto,
  ) {
    return this.projectService.findAll(
      req.activeOrganizationId!,
      query.search,
      query.stageId,
      query.ownerId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.create(
      req.activeOrganizationId!,
      req.user!.userId,
      dto,
    );
  }

  @Get(':id')
  async findById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectService.findById(id, req.activeOrganizationId!);
  }

  @Patch(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.projectService.delete(id, req.activeOrganizationId!);
  }

  @Patch(':id/stage')
  @HttpCode(HttpStatus.OK)
  async transitionStage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StageTransitionDto,
  ) {
    return this.projectService.transitionStage(
      id,
      req.activeOrganizationId!,
      req.user!.userId,
      req.user?.role,
      dto,
    );
  }

  @Get(':id/profitability')
  async getProfitability(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.projectService.getProfitability(id, req.activeOrganizationId!);
  }

  @Post(':id/sync-master')
  @HttpCode(HttpStatus.OK)
  async syncMaster(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectService.syncMaster(id, req.activeOrganizationId!);
  }

  @Post(':id/sync-master/apply')
  @HttpCode(HttpStatus.OK)
  async syncMasterApply(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SyncMasterApplyDto,
  ) {
    return this.projectService.syncMasterApply(
      id,
      req.activeOrganizationId!,
      req.user!.userId,
      dto.itemIds,
    );
  }

  @Post(':id/draft-po')
  @HttpCode(HttpStatus.OK)
  async getDraftPO(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectService.getDraftPO(id, req.activeOrganizationId!);
  }

  @Get(':id/audit-log')
  async getAuditLog(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.projectService.getAuditLog(id, req.activeOrganizationId!, {
      userId,
      action,
      from,
      to,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
