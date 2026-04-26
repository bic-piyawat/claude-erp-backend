import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class StageOrderItem {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  order!: number;
}

export class ReorderStagesDto {
  @ApiProperty({ type: [StageOrderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageOrderItem)
  stages!: StageOrderItem[];
}
