import { Injectable } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CustomerEntity {
  id: string;
  name: string;
  type: CustomerType;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  organizationId: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

const SELECT = {
  id: true,
  name: true,
  type: true,
  taxId: true,
  phone: true,
  email: true,
  address: true,
  organizationId: true,
} as const;

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<CustomerEntity>> {
    const where = {
      organizationId,
      isDeleted: false,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
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
  ): Promise<CustomerEntity | null> {
    return this.prisma.customer.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async findByNameAndOrg(
    name: string,
    organizationId: string,
  ): Promise<CustomerEntity | null> {
    return this.prisma.customer.findFirst({
      where: { name, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      type?: CustomerType;
      taxId?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ): Promise<CustomerEntity> {
    return this.prisma.customer.create({
      data: { ...data, organizationId },
      select: SELECT,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      taxId?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ): Promise<CustomerEntity> {
    return this.prisma.customer.update({
      where: { id },
      data,
      select: SELECT,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
