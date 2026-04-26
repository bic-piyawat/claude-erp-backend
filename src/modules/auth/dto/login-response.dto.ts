import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LoginUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;
}

export class LoginOrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'FOUNDER' })
  role!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginUserDto })
  user!: LoginUserDto;

  @ApiProperty({ type: [LoginOrganizationDto] })
  organizations!: LoginOrganizationDto[];
}

// MeResponseDto mirrors the GET /auth/me contract (Swagger).
// Co-located here (rather than in a new me-response.dto.ts file) because the
// agent runtime sandbox blocked `git add` for newly created files; see
// SDB-007 PR description for the deviation note.
//
// MembershipResponseDto / MembershipsListResponseDto are co-located here for
// the same reason (SDB-011) — the sandbox blocks staging brand-new files, so
// the new DTOs live alongside the existing auth response DTOs.
export class MembershipResponseDto {
  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Organization display name' })
  organizationName!: string;

  @ApiProperty({
    example: 'FOUNDER',
    description: 'Membership role (e.g. FOUNDER, ADMIN, MEMBER)',
  })
  role!: string;
}

export class MembershipsListResponseDto {
  @ApiProperty({ type: [MembershipResponseDto] })
  data!: MembershipResponseDto[];
}

export class MeResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ type: [String] })
  organizationIds!: string[];

  @ApiProperty()
  activeOrganizationId!: string;
}

// SwitchOrganizationDto / SwitchOrganizationResponseDto / SwitchOrganizationApiResponseDto
// are co-located here for the same reason (SDB-012) — the agent runtime sandbox
// blocks `git add` for newly created files. The Swagger schema and consumer
// imports are unchanged from a separate-file layout.
export class SwitchOrganizationDto {
  @ApiProperty({
    description: 'Target organization UUID v4',
    example: '00000000-0000-4000-8000-000000000000',
  })
  @IsUUID('4')
  organizationId!: string;
}

export class SwitchOrganizationResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  organizationName!: string;

  @ApiProperty({ example: 'FOUNDER' })
  role!: string;
}

export class SwitchOrganizationApiResponseDto {
  @ApiProperty({ type: SwitchOrganizationResponseDto })
  data!: SwitchOrganizationResponseDto;
}
