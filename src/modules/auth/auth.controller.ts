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
import { LoginResponseDto } from './dto/login-response.dto';
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
    summary: 'Return authenticated user and active organization',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        userId: 'user-uuid',
        organizationIds: ['org-1', 'org-2'],
        activeOrganizationId: 'org-1',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Active organization not selected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden organization' })
  me(@Req() req: AuthenticatedRequest): {
    userId: string;
    organizationIds: string[];
    activeOrganizationId: string;
  } {
    return {
      userId: req.user!.userId,
      organizationIds: req.user!.organizationIds,
      activeOrganizationId: req.activeOrganizationId!,
    };
  }
}
