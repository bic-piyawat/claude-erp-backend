import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UploadAttachmentDto {
  @ApiPropertyOptional({
    enum: ['CUSTOMER_PO', 'QUOTATION', 'DRAWING', 'OTHER'],
    default: 'OTHER',
  })
  @IsOptional()
  @IsEnum(AttachmentCategory)
  category?: AttachmentCategory;
}
