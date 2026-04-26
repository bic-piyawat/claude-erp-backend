import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductRepository, ProductEntity } from './product.repository';
import { PaginatedResult } from '../customer/customer.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ProductEntity>> {
    return this.productRepository.findAll(organizationId, search, page, limit);
  }

  async findById(id: string, organizationId: string): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id, organizationId);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(
    organizationId: string,
    dto: CreateProductDto,
  ): Promise<ProductEntity> {
    return this.productRepository.create(organizationId, dto);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.productRepository.findById(id, organizationId);
    if (!product) throw new NotFoundException('Product not found');
    return this.productRepository.update(id, dto);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const product = await this.productRepository.findById(id, organizationId);
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepository.softDelete(id);
  }
}
