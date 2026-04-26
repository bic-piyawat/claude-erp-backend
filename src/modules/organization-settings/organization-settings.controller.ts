import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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
import { OrganizationSettingsService } from './organization-settings.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';

@ApiTags('organization-settings')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('organization')
export class OrganizationSettingsController {
  constructor(
    private readonly organizationSettingsService: OrganizationSettingsService,
  ) {}

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get organization VAT rate settings' })
  async getSettings(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ vatRate: number }> {
    return this.organizationSettingsService.getSettings(
      req.activeOrganizationId!,
    );
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update organization VAT rate settings' })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationSettingsDto,
  ): Promise<{ vatRate: number }> {
    const result = await this.organizationSettingsService.updateSettings(
      req.activeOrganizationId!,
      dto.vatRate,
    );
    return { vatRate: result.vatRate };
  }
}
