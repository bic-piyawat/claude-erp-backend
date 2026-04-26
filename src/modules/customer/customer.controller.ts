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
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@ApiTags('customers')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'List customers with pagination and search' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryCustomerDto,
  ) {
    return this.customerService.findAll(
      req.activeOrganizationId!,
      query.search,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a customer' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customerService.create(req.activeOrganizationId!, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  async findById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.customerService.findById(id, req.activeOrganizationId!);
  }

  @Patch(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a customer' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @UseInterceptors(AuditTrailInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a customer' })
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.customerService.delete(id, req.activeOrganizationId!);
  }
}
