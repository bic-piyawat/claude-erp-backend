import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ContactPersonEntity {
  id: string;
  customerId: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  organizationId: string;
  createdAt: Date;
}

const SELECT = {
  id: true,
  customerId: true,
  name: true,
  position: true,
  phone: true,
  email: true,
  isPrimary: true,
  organizationId: true,
  createdAt: true,
} as const;

@Injectable()
export class ContactPersonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ContactPersonEntity | null> {
    return this.prisma.contactPerson.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: SELECT,
    });
  }

  async findAllByCustomer(
    customerId: string,
    organizationId: string,
  ): Promise<ContactPersonEntity[]> {
    return this.prisma.contactPerson.findMany({
      where: { customerId, organizationId, isDeleted: false },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: {
    customerId: string;
    organizationId: string;
    name: string;
    position?: string;
    phone?: string;
    email?: string;
    isPrimary?: boolean;
  }): Promise<ContactPersonEntity> {
    return this.prisma.contactPerson.create({
      data: {
        customerId: data.customerId,
        organizationId: data.organizationId,
        name: data.name,
        position: data.position,
        phone: data.phone,
        email: data.email,
        isPrimary: data.isPrimary ?? false,
      },
      select: SELECT,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      position?: string;
      phone?: string;
      email?: string;
      isPrimary?: boolean;
    },
  ): Promise<ContactPersonEntity> {
    return this.prisma.contactPerson.update({
      where: { id },
      data,
      select: SELECT,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.contactPerson.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
