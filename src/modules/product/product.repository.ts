import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedResult } from '../customer/customer.repository';

export interface ProductEntity {
  id: string;
  name: string;
  uom: string | null;
  category: string | null;
  standardCost: number;
  lastPrice: number;
  lastUpdatedDate: Date | null;
  defaultSupplierId: string | null;
  organizationId: string;
}

const SELECT = {
  id: true,
  name: true,
  uom: true,
  category: true,
  standardCost: true,
  lastPrice: true,
  lastUpdatedDate: true,
  defaultSupplierId: true,
  organizationId: true,
};

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ProductEntity>> {
    const where = {
      organizationId,
      isDeleted: false,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      itemsPerPage: limit,
    };
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ProductEntity | null> {
    return this.prisma.product.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      uom?: string;
      category?: string;
      standardCost?: number;
      defaultSupplierId?: string;
    },
  ): Promise<ProductEntity> {
    return this.prisma.product.create({
      data: { ...data, organizationId },
      select: SELECT,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      uom?: string;
      category?: string;
      standardCost?: number;
      defaultSupplierId?: string;
      lastPrice?: number;
      lastUpdatedDate?: Date;
    },
  ): Promise<ProductEntity> {
    return this.prisma.product.update({ where: { id }, data, select: SELECT });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
