import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class FieldOrderItem {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderCustomFieldsDto {
  @ApiProperty({ type: [FieldOrderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOrderItem)
  fields!: FieldOrderItem[];
}
