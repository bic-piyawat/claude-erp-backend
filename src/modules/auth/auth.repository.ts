import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UserWithMemberships {
  id: string;
  email: string;
  password: string;
  isDeleted: boolean;
  memberships: {
    organizationId: string;
    role: string;
    organization: { id: string; name: string };
  }[];
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveUserByEmail(
    email: string,
  ): Promise<UserWithMemberships | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
      include: {
        memberships: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      isDeleted: user.isDeleted,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: { id: m.organization.id, name: m.organization.name },
      })),
    };
  }
}
