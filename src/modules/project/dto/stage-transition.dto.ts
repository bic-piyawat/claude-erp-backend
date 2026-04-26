import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StageTransitionDto {
  @ApiProperty({ example: 'stage-uuid' })
  @IsString()
  stageId!: string;

  @ApiPropertyOptional({ example: 'PO-2026-001' })
  @IsOptional()
  @IsString()
  customerPoNumber?: string;
}
