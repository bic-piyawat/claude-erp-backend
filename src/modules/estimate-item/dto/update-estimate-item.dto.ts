import { PartialType } from '@nestjs/mapped-types';
import { CreateEstimateItemDto } from './create-estimate-item.dto';

export class UpdateEstimateItemDto extends PartialType(CreateEstimateItemDto) {}
