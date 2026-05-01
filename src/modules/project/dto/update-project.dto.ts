import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CustomFieldValueUpdateDto {
  @ApiPropertyOptional()
  @IsString()
  fieldId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalProjectPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPoNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  customerPoIssuedDate?: string;

  @ApiPropertyOptional({ type: [CustomFieldValueUpdateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldValueUpdateDto)
  customFieldValues?: CustomFieldValueUpdateDto[];
}
