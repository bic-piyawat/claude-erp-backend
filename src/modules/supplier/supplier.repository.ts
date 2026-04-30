import { Injectable } from '@nestjs/common';
import { SupplierType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedResult } from '../customer/customer.repository';

export interface SupplierEntity {
  id: string;
  name: string;
  type: SupplierType;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  organizationId: string;
}

const SELECT = {
  id: true,
  name: true,
  type: true,
  paymentTerms: true,
  leadTimeDays: true,
  phone: true,
  email: true,
  address: true,
  organizationId: true,
} as const;

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search: string | undefined,
    page: number,
    limit: number,
    type?: SupplierType,
  ): Promise<PaginatedResult<SupplierEntity>> {
    const where = {
      organizationId,
      isDeleted: false,
      ...(search ? { name: { contains: search } } : {}),
      ...(type ? { type } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
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
  ): Promise<SupplierEntity | null> {
    return this.prisma.supplier.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async findByNameAndOrg(
    name: string,
    organizationId: string,
  ): Promise<SupplierEntity | null> {
    return this.prisma.supplier.findFirst({
      where: { name, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      type?: SupplierType;
      paymentTerms?: string;
      leadTimeDays?: number;
      phone?: string;
      email?: string;
      address?: string;
    },
  ): Promise<SupplierEntity> {
    return this.prisma.supplier.create({
      data: { ...data, organizationId },
      select: SELECT,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      paymentTerms?: string;
      leadTimeDays?: number;
      phone?: string;
      email?: string;
      address?: string;
    },
  ): Promise<SupplierEntity> {
    return this.prisma.supplier.update({ where: { id }, data, select: SELECT });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.supplier.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
