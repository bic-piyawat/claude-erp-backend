import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string };
  organizations: { id: string; name: string; role: string }[];
}

const INVALID_CREDENTIALS = 'Invalid credentials';

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
      user: { id: user.id, email: user.email },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }
}
