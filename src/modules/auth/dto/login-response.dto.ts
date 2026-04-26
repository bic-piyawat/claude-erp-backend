import { ApiProperty } from '@nestjs/swagger';

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
