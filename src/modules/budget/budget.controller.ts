import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { BudgetService } from './budget.service';

@ApiTags('budget')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller()
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('projects/:projectId/budget')
  async getCurrentBudget(@Param('projectId') projectId: string) {
    return this.budgetService.getCurrentBudget(projectId);
  }

  @Post('projects/:projectId/budget/save')
  @HttpCode(HttpStatus.CREATED)
  async saveVersion(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.budgetService.saveNewVersion(projectId, req.user!.userId);
  }

  @Get('projects/:projectId/budget/versions')
  async listVersions(@Param('projectId') projectId: string) {
    return this.budgetService.listVersions(projectId);
  }

  @Get('projects/:projectId/budget/compare')
  async compareVersions(
    @Param('projectId') projectId: string,
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    return this.budgetService.compareVersions(projectId, v1, v2);
  }

  @Post('projects/:projectId/budget/restore/:versionId')
  @HttpCode(HttpStatus.CREATED)
  async restoreVersion(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.budgetService.restoreVersion(
      projectId,
      versionId,
      req.user!.userId,
    );
  }

  @Post('budget/:id/unlock')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.OK)
  async unlockBudget(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.budgetService.unlockBudget(
      id,
      req.user!.userId,
      req.activeOrganizationId!,
    );
  }
}
