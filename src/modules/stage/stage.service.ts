import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StageRepository, StageEntity } from './stage.repository';

const BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION';

@Injectable()
export class StageService {
  constructor(private readonly stageRepository: StageRepository) {}

  async findAll(organizationId: string): Promise<StageEntity[]> {
    return this.stageRepository.findAllByOrganization(organizationId);
  }

  async create(
    organizationId: string,
    name: string,
    order: number,
  ): Promise<StageEntity> {
    return this.stageRepository.create(organizationId, name, order);
  }

  async update(
    id: string,
    organizationId: string,
    data: { name?: string; order?: number },
  ): Promise<StageEntity> {
    const stage = await this.stageRepository.findById(id, organizationId);
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }
    return this.stageRepository.update(id, data);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const stage = await this.stageRepository.findById(id, organizationId);
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    const hasProjects = await this.stageRepository.hasActiveProjects(id);
    if (hasProjects) {
      throw new HttpException(
        {
          statusCode: 422,
          code: BUSINESS_RULE_VIOLATION,
          message: 'Stage has active projects',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.stageRepository.softDelete(id);
  }

  async reorder(
    organizationId: string,
    stages: { id: string; order: number }[],
  ): Promise<void> {
    for (const s of stages) {
      const stage = await this.stageRepository.findById(s.id, organizationId);
      if (!stage) {
        throw new NotFoundException(`Stage ${s.id} not found`);
      }
    }
    await this.stageRepository.reorder(stages);
  }
}
