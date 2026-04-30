import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import { CreateEstimateItemDto } from './create-estimate-item.dto';

export type BulkReplaceMode = 'replace' | 'append';

export class BulkReplaceEstimateItemsDto {
  @ApiProperty({ enum: ['replace', 'append'] })
  @IsIn(['replace', 'append'])
  mode!: BulkReplaceMode;

  @ApiProperty({ type: [CreateEstimateItemDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreateEstimateItemDto)
  items!: CreateEstimateItemDto[];
}
