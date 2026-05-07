import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateStageDto {
  // inline-literal-ok: Swagger example value, not business logic. The actual
  // canonical stage names live in src/common/constants/stage-name.constant.ts.
  @ApiProperty({ example: 'Lead' })
  @IsString()
  @MinLength(1)
  name!: string;

  // inline-literal-ok: Swagger example value (default order for the first stage).
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order!: number;
}
