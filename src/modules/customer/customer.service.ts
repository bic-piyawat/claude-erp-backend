import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import {
  CustomerRepository,
  CustomerEntity,
  PaginatedResult,
} from './customer.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { BUSINESS_RULE_ERROR_CODE } from '../../common/constants/business-rule-error-code.constant';


@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<CustomerEntity>> {
    return this.customerRepository.findAll(organizationId, search, page, limit);
  }

  async findById(id: string, organizationId: string): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(id, organizationId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async create(
    organizationId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerEntity> {
    const existing = await this.customerRepository.findByNameAndOrg(
      dto.name,
      organizationId,
    );
    if (existing) {
      throw new ConflictException(
        'Customer name already exists in this organization',
      );
    }
    return this.customerRepository.create(organizationId, {
      ...dto,
      type: dto.type ?? CustomerType.COMPANY,
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerEntity> {
    if ('type' in dto && dto.type !== undefined) {
      throw new HttpException(
        {
          statusCode: 422,
          code: BUSINESS_RULE_ERROR_CODE.BUSINESS_RULE_VIOLATION,
          message:
            'Customer type is immutable; create a new customer if type is wrong',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const customer = await this.customerRepository.findById(id, organizationId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (dto.name && dto.name !== customer.name) {
      const existing = await this.customerRepository.findByNameAndOrg(
        dto.name,
        organizationId,
      );
      if (existing) {
        throw new ConflictException(
          'Customer name already exists in this organization',
        );
      }
    }
    return this.customerRepository.update(id, dto);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const customer = await this.customerRepository.findById(id, organizationId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    await this.customerRepository.softDelete(id);
  }
}
