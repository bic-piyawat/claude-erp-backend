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
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';

@ApiTags('suppliers')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QuerySupplierDto,
  ) {
    return this.supplierService.findAll(
      req.activeOrganizationId!,
      query.search,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.supplierService.create(req.activeOrganizationId!, dto);
  }

  @Get(':id')
  async findById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.supplierService.findById(id, req.activeOrganizationId!);
  }

  @Patch(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.supplierService.delete(id, req.activeOrganizationId!);
  }
}
