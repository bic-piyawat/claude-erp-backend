import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @ApiProperty({ example: 7, description: 'VAT rate in percent' })
  @IsNumber()
  @Min(0)
  vatRate!: number;
}
