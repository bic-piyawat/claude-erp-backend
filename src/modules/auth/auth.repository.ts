import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UserWithMemberships {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isDeleted: boolean;
  memberships: {
    organizationId: string;
    role: string;
    organization: { id: string; name: string };
  }[];
}

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface MembershipDto {
  organizationId: string;
  organizationName: string;
  role: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveUserByEmail(
    email: string,
  ): Promise<UserWithMemberships | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isDeleted: true,
        memberships: {
          select: {
            organizationId: true,
            role: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isDeleted: user.isDeleted,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: { id: m.organization.id, name: m.organization.name },
      })),
    };
  }

  async findUserProfileById(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    if (!user) return null;

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }

  async findMembershipsByUserId(userId: string): Promise<MembershipDto[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      role: row.role,
    }));
  }
}
