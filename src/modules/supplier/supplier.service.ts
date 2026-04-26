import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplierRepository, SupplierEntity } from './supplier.repository';
import { PaginatedResult } from '../customer/customer.repository';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly supplierRepository: SupplierRepository) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<SupplierEntity>> {
    return this.supplierRepository.findAll(organizationId, search, page, limit);
  }

  async findById(id: string, organizationId: string): Promise<SupplierEntity> {
    const supplier = await this.supplierRepository.findById(id, organizationId);
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(
    organizationId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierEntity> {
    const existing = await this.supplierRepository.findByNameAndOrg(
      dto.name,
      organizationId,
    );
    if (existing)
      throw new ConflictException(
        'Supplier name already exists in this organization',
      );
    return this.supplierRepository.create(organizationId, dto);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierEntity> {
    const supplier = await this.supplierRepository.findById(id, organizationId);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (dto.name && dto.name !== supplier.name) {
      const existing = await this.supplierRepository.findByNameAndOrg(
        dto.name,
        organizationId,
      );
      if (existing)
        throw new ConflictException(
          'Supplier name already exists in this organization',
        );
    }
    return this.supplierRepository.update(id, dto);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const supplier = await this.supplierRepository.findById(id, organizationId);
    if (!supplier) throw new NotFoundException('Supplier not found');
    await this.supplierRepository.softDelete(id);
  }
}
