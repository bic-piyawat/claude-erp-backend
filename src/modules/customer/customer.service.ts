import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerRepository,
  CustomerEntity,
  PaginatedResult,
} from './customer.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

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
    return this.customerRepository.create(organizationId, dto);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerEntity> {
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
