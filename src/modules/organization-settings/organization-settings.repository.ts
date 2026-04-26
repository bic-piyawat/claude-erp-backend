import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface OrganizationSettingsEntity {
  id: string;
  organizationId: string;
  vatRate: number;
}

@Injectable()
export class OrganizationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationSettingsEntity | null> {
    return this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
  }

  async upsert(
    organizationId: string,
    vatRate: number,
  ): Promise<OrganizationSettingsEntity> {
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, vatRate },
      update: { vatRate },
    });
  }
}
