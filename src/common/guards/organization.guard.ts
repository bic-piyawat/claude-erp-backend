import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  ACTIVE_ORG_COOKIE_NAME,
  AUTH_COOKIE_NAME,
} from '../constants/auth.constant';
import { AuthRepository } from '../../modules/auth/auth.repository';

interface JwtPayload {
  sub: string;
  organizationIds: string[];
  role?: string;
  isFounder?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    organizationIds: string[];
    role?: string;
    isFounder?: boolean;
  };
  activeOrganizationId?: string;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    const headerValue = request.headers['x-organization-id'];
    const headerOrg = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const cookieOrg = request.cookies?.[ACTIVE_ORG_COOKIE_NAME];
    const activeOrganizationId = headerOrg ?? cookieOrg;

    if (!activeOrganizationId) {
      throw new BadRequestException('Active organization not selected');
    }

    if (!payload.organizationIds.includes(activeOrganizationId)) {
      throw new ForbiddenException('Forbidden organization');
    }

    // Look up the user's per-org Membership.role for the active org and stamp
    // it onto request.user so RolesGuard (which runs after this guard) can
    // gate against @Roles(...) decorators. The JWT itself does NOT carry the
    // per-org role — orgs change less often than tokens, but the role within
    // an org might change without re-issuing the token, so we look up live.
    // payload.role exists on the JwtPayload type but is currently unused at
    // sign time; kept on the type as a forward-compat hook.
    const role =
      (await this.authRepository.findRoleForUserInOrg(
        payload.sub,
        activeOrganizationId,
      )) ?? payload.role;

    request.user = {
      userId: payload.sub,
      organizationIds: payload.organizationIds,
      role: role ?? undefined,
      isFounder: payload.isFounder ?? false,
    };
    request.activeOrganizationId = activeOrganizationId;
    return true;
  }
}
