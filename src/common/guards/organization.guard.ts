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

interface JwtPayload {
  sub: string;
  organizationIds: string[];
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; organizationIds: string[]; role?: string };
  activeOrganizationId?: string;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

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

    request.user = {
      userId: payload.sub,
      organizationIds: payload.organizationIds,
      role: payload.role,
    };
    request.activeOrganizationId = activeOrganizationId;
    return true;
  }
}
