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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { StageService } from './stage.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

@ApiTags('stages')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('stages')
export class StageController {
  constructor(private readonly stageService: StageService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stages ordered by order field' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.stageService.findAll(req.activeOrganizationId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new stage' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStageDto) {
    return this.stageService.create(
      req.activeOrganizationId!,
      dto.name,
      dto.order,
    );
  }

  @Patch('reorder')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder stages' })
  async reorder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReorderStagesDto,
  ) {
    await this.stageService.reorder(req.activeOrganizationId!, dto.stages);
    return { reordered: true };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a stage' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.stageService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a stage' })
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.stageService.delete(id, req.activeOrganizationId!);
  }
}
