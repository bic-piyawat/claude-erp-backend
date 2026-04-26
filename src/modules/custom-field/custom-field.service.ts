import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomFieldRepository,
  CustomFieldEntity,
} from './custom-field.repository';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

@Injectable()
export class CustomFieldService {
  constructor(private readonly customFieldRepository: CustomFieldRepository) {}

  async findAll(organizationId: string): Promise<CustomFieldEntity[]> {
    return this.customFieldRepository.findAllByOrganization(organizationId);
  }

  async create(
    organizationId: string,
    dto: CreateCustomFieldDto,
  ): Promise<CustomFieldEntity> {
    const { options, ...rest } = dto;
    return this.customFieldRepository.create(organizationId, {
      ...rest,
      options: options ? JSON.stringify(options) : undefined,
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldEntity> {
    const field = await this.customFieldRepository.findById(id, organizationId);
    if (!field) throw new NotFoundException('Custom field not found');

    const { options, ...rest } = dto;
    return this.customFieldRepository.update(id, {
      ...rest,
      options: options ? JSON.stringify(options) : undefined,
    });
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const field = await this.customFieldRepository.findById(id, organizationId);
    if (!field) throw new NotFoundException('Custom field not found');
    await this.customFieldRepository.softDelete(id);
  }

  async reorder(
    organizationId: string,
    fields: { id: string; order: number }[],
  ): Promise<void> {
    for (const f of fields) {
      const field = await this.customFieldRepository.findById(
        f.id,
        organizationId,
      );
      if (!field) throw new NotFoundException(`Custom field ${f.id} not found`);
    }
    await this.customFieldRepository.reorder(fields);
  }
}
