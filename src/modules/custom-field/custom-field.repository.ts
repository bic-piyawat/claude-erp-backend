import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CustomFieldType, FieldScope } from '@prisma/client';

export interface CustomFieldEntity {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  isMandatory: boolean;
  placeholder: string | null;
  defaultValue: string | null;
  options: string | null;
  scope: FieldScope;
  order: number;
  organizationId: string;
}

@Injectable()
export class CustomFieldRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrganization(
    organizationId: string,
  ): Promise<CustomFieldEntity[]> {
    return this.prisma.customFieldDefinition.findMany({
      where: { organizationId, isDeleted: false },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        fieldName: true,
        fieldType: true,
        isMandatory: true,
        placeholder: true,
        defaultValue: true,
        options: true,
        scope: true,
        order: true,
        organizationId: true,
      },
    }) as Promise<CustomFieldEntity[]>;
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<CustomFieldEntity | null> {
    return this.prisma.customFieldDefinition.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: {
        id: true,
        fieldName: true,
        fieldType: true,
        isMandatory: true,
        placeholder: true,
        defaultValue: true,
        options: true,
        scope: true,
        order: true,
        organizationId: true,
      },
    }) as Promise<CustomFieldEntity | null>;
  }

  async create(
    organizationId: string,
    data: {
      fieldName: string;
      fieldType: CustomFieldType;
      isMandatory?: boolean;
      placeholder?: string;
      defaultValue?: string;
      scope?: FieldScope;
      order?: number;
      options?: string;
    },
  ): Promise<CustomFieldEntity> {
    return this.prisma.customFieldDefinition.create({
      data: {
        ...data,
        organizationId,
        isMandatory: data.isMandatory ?? false,
        order: data.order ?? 0,
      },
      select: {
        id: true,
        fieldName: true,
        fieldType: true,
        isMandatory: true,
        placeholder: true,
        defaultValue: true,
        options: true,
        scope: true,
        order: true,
        organizationId: true,
      },
    }) as Promise<CustomFieldEntity>;
  }

  async update(
    id: string,
    data: Partial<{
      fieldName: string;
      fieldType: CustomFieldType;
      isMandatory: boolean;
      placeholder: string;
      defaultValue: string;
      scope: FieldScope;
      order: number;
      options: string;
    }>,
  ): Promise<CustomFieldEntity> {
    return this.prisma.customFieldDefinition.update({
      where: { id },
      data,
      select: {
        id: true,
        fieldName: true,
        fieldType: true,
        isMandatory: true,
        placeholder: true,
        defaultValue: true,
        options: true,
        scope: true,
        order: true,
        organizationId: true,
      },
    }) as Promise<CustomFieldEntity>;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async reorder(fields: { id: string; order: number }[]): Promise<void> {
    await this.prisma.$transaction(
      fields.map((f) =>
        this.prisma.customFieldDefinition.update({
          where: { id: f.id },
          data: { order: f.order },
        }),
      ),
    );
  }
}
