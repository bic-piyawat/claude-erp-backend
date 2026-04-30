import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryAttachmentDto {
  @ApiPropertyOptional({
    enum: ['CUSTOMER_PO', 'QUOTATION', 'DRAWING', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(AttachmentCategory)
  category?: AttachmentCategory;
}
