import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import { CreateCostItemDto } from './create-cost-item.dto';

export type BulkReplaceCostItemMode = 'replace' | 'append';

export class BulkReplaceCostItemsDto {
  @ApiProperty({ enum: ['replace', 'append'] })
  @IsIn(['replace', 'append'])
  mode!: BulkReplaceCostItemMode;

  @ApiProperty({ type: [CreateCostItemDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreateCostItemDto)
  items!: CreateCostItemDto[];
}
