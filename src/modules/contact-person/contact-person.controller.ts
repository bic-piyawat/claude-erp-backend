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
  UseInterceptors,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedRequest,
  OrganizationGuard,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { ContactPersonService } from './contact-person.service';
import { CreateContactPersonDto } from './dto/create-contact-person.dto';
import { UpdateContactPersonDto } from './dto/update-contact-person.dto';

@ApiTags('contact-persons')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@UseInterceptors(AuditTrailInterceptor)
@Controller('customers/:customerId/contacts')
export class ContactPersonController {
  constructor(private readonly contactPersonService: ContactPersonService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a contact person to a customer' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
    @Body() dto: CreateContactPersonDto,
  ) {
    return this.contactPersonService.create(
      customerId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List contact persons for a customer' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
  ) {
    return this.contactPersonService.findAllByCustomer(
      customerId,
      req.activeOrganizationId!,
    );
  }

  @Patch(':contactId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a contact person' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactPersonDto,
  ) {
    return this.contactPersonService.update(
      customerId,
      contactId,
      dto,
      req.activeOrganizationId!,
    );
  }

  @Delete(':contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a contact person' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
  ) {
    await this.contactPersonService.delete(
      customerId,
      contactId,
      req.activeOrganizationId!,
    );
  }
}
