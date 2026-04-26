import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository, MembershipDto, UserProfile } from './auth.repository';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface LoginResult {
  accessToken: string;
  user: LoginUser;
  organizations: { id: string; name: string; role: string }[];
}

const INVALID_CREDENTIALS = 'Invalid credentials';
const USER_NOT_FOUND = 'User not found';
const FORBIDDEN_ORGANIZATION = 'Forbidden organization';
const MEMBERSHIP_NOT_FOUND = 'Membership not found';

export interface SwitchOrganizationResult {
  organizationId: string;
  organizationName: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.authRepository.findActiveUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const organizationIds = user.memberships.map((m) => m.organizationId);
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      organizationIds,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.authRepository.findUserProfileById(userId);
    if (!profile) {
      throw new NotFoundException(USER_NOT_FOUND);
    }
    return profile;
  }

  async listMemberships(userId: string): Promise<MembershipDto[]> {
    const memberships =
      await this.authRepository.findMembershipsByUserId(userId);
    return [...memberships].sort((a, b) =>
      a.organizationName.localeCompare(b.organizationName, undefined, {
        sensitivity: 'base',
      }),
    );
  }

  async switchOrganization(
    userId: string,
    organizationIds: string[],
    targetOrganizationId: string,
  ): Promise<SwitchOrganizationResult> {
    if (!organizationIds.includes(targetOrganizationId)) {
      throw new ForbiddenException(FORBIDDEN_ORGANIZATION);
    }

    const memberships =
      await this.authRepository.findMembershipsByUserId(userId);
    const target = memberships.find(
      (m) => m.organizationId === targetOrganizationId,
    );
    if (!target) {
      throw new NotFoundException(MEMBERSHIP_NOT_FOUND);
    }

    return {
      organizationId: target.organizationId,
      organizationName: target.organizationName,
      role: target.role,
    };
  }
}
