import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, MeResponseDto } from './dto/login-response.dto';
import {
  MembershipResponseDto,
  MembershipsListResponseDto,
} from './dto/membership-response.dto';
import {
  AUTH_COOKIE_NAME,
  JWT_COOKIE_MAX_AGE_MS,
} from '../../common/constants/auth.constant';
import {
  AuthenticatedRequest,
  OrganizationGuard,
} from '../../common/guards/organization.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and set HttpOnly JWT cookie' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { accessToken, user, organizations } = await this.authService.login({
      email: dto.email,
      password: dto.password,
    });

    const secure =
      this.configService.get<string>('COOKIE_SECURE', 'false') === 'true';
    res.cookie(AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: JWT_COOKIE_MAX_AGE_MS,
      path: '/',
    });

    return { user, organizations };
  }

  @Get('me')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Return authenticated user profile and active organization',
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 400, description: 'Active organization not selected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden organization' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async me(@Req() req: AuthenticatedRequest): Promise<MeResponseDto> {
    const profile = await this.authService.getProfile(req.user!.userId);
    return {
      userId: profile.userId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      organizationIds: req.user!.organizationIds,
      activeOrganizationId: req.activeOrganizationId!,
    };
  }

  @Get('me/memberships')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({
    summary: "List the authenticated user's memberships across organizations",
  })
  @ApiResponse({ status: 200, type: MembershipsListResponseDto })
  @ApiResponse({ status: 400, description: 'Active organization not selected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden organization' })
  async listMyMemberships(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ data: MembershipResponseDto[] }> {
    const memberships = await this.authService.listMemberships(
      req.user!.userId,
    );
    return { data: memberships };
  }
}
