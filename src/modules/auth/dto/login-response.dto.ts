import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;
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
