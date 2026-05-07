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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CustomFieldService } from './custom-field.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ReorderCustomFieldsDto } from './dto/reorder-custom-fields.dto';

@ApiTags('custom-fields')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard, RolesGuard)
// PRJ-073 (revised 2026-05-07): Custom Fields is strictly org SUPER_ADMIN.
// FOUNDER (system role) is intentionally NOT granted access — managing custom
// fields is a per-organization concern that the org's own super-admin owns.
@Roles(Role.SUPER_ADMIN)
@Controller('admin/custom-fields')
export class CustomFieldController {
  constructor(private readonly customFieldService: CustomFieldService) {}

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.customFieldService.findAll(req.activeOrganizationId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldService.create(req.activeOrganizationId!, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReorderCustomFieldsDto,
  ) {
    await this.customFieldService.reorder(
      req.activeOrganizationId!,
      dto.fields,
    );
    return { reordered: true };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.customFieldService.delete(id, req.activeOrganizationId!);
  }
}
