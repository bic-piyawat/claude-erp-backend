import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SyncMasterApplyDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];
}
