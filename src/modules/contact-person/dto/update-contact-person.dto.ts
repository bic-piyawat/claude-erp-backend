import { PartialType } from '@nestjs/mapped-types';
import { CreateContactPersonDto } from './create-contact-person.dto';

export class UpdateContactPersonDto extends PartialType(
  CreateContactPersonDto,
) {}
