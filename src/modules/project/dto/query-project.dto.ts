import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const PROJECT_SORTABLE_FIELDS = [
  'name',
  'ownerName',
  'customerName',
  'stageName',
  'status',
  'totalProjectPrice',
  'totalCost',
  'createdAt',
  'expectedCloseDate',
] as const;

export type ProjectSortField = (typeof PROJECT_SORTABLE_FIELDS)[number];

export class QueryProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: PROJECT_SORTABLE_FIELDS })
  @IsOptional()
  @IsIn(PROJECT_SORTABLE_FIELDS as unknown as string[])
  sortBy?: ProjectSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
