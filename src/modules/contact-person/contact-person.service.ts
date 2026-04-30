import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CustomerRepository } from '../customer/customer.repository';
import {
  ContactPersonEntity,
  ContactPersonRepository,
} from './contact-person.repository';
import { CreateContactPersonDto } from './dto/create-contact-person.dto';
import { UpdateContactPersonDto } from './dto/update-contact-person.dto';

const BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION';

@Injectable()
export class ContactPersonService {
  constructor(
    private readonly contactPersonRepository: ContactPersonRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    customerId: string,
    dto: CreateContactPersonDto,
    organizationId: string,
  ): Promise<ContactPersonEntity> {
    await this.assertCustomerSupportsContacts(customerId, organizationId);

    if (dto.isPrimary === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.contactPerson.updateMany({
          where: { customerId, isPrimary: true, isDeleted: false },
          data: { isPrimary: false },
        });
        return tx.contactPerson.create({
          data: {
            customerId,
            organizationId,
            name: dto.name,
            position: dto.position,
            phone: dto.phone,
            email: dto.email,
            isPrimary: true,
          },
          select: {
            id: true,
            customerId: true,
            name: true,
            position: true,
            phone: true,
            email: true,
            isPrimary: true,
            organizationId: true,
            createdAt: true,
          },
        });
      });
    }

    return this.contactPersonRepository.create({
      customerId,
      organizationId,
      name: dto.name,
      position: dto.position,
      phone: dto.phone,
      email: dto.email,
      isPrimary: dto.isPrimary ?? false,
    });
  }

  async findAllByCustomer(
    customerId: string,
    organizationId: string,
  ): Promise<ContactPersonEntity[]> {
    await this.assertCustomerSupportsContacts(customerId, organizationId);
    return this.contactPersonRepository.findAllByCustomer(
      customerId,
      organizationId,
    );
  }

  async findById(
    customerId: string,
    contactId: string,
    organizationId: string,
  ): Promise<ContactPersonEntity> {
    await this.assertCustomerSupportsContacts(customerId, organizationId);
    const contact = await this.contactPersonRepository.findById(
      contactId,
      organizationId,
    );
    if (!contact || contact.customerId !== customerId) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(
    customerId: string,
    contactId: string,
    dto: UpdateContactPersonDto,
    organizationId: string,
  ): Promise<ContactPersonEntity> {
    const existing = await this.findById(customerId, contactId, organizationId);

    if (dto.isPrimary === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.contactPerson.updateMany({
          where: {
            customerId,
            id: { not: contactId },
            isPrimary: true,
            isDeleted: false,
          },
          data: { isPrimary: false },
        });
        return tx.contactPerson.update({
          where: { id: contactId },
          data: {
            name: dto.name,
            position: dto.position,
            phone: dto.phone,
            email: dto.email,
            isPrimary: true,
          },
          select: {
            id: true,
            customerId: true,
            name: true,
            position: true,
            phone: true,
            email: true,
            isPrimary: true,
            organizationId: true,
            createdAt: true,
          },
        });
      });
    }

    return this.contactPersonRepository.update(contactId, {
      name: dto.name ?? existing.name,
      position: dto.position,
      phone: dto.phone,
      email: dto.email,
      isPrimary: dto.isPrimary,
    });
  }

  async delete(
    customerId: string,
    contactId: string,
    organizationId: string,
  ): Promise<void> {
    await this.findById(customerId, contactId, organizationId);
    await this.contactPersonRepository.softDelete(contactId);
  }

  private async assertCustomerSupportsContacts(
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.customerRepository.findById(
      customerId,
      organizationId,
    );
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (customer.type === CustomerType.INDIVIDUAL) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: BUSINESS_RULE_VIOLATION,
          message:
            'INDIVIDUAL customers do not support contact persons; use the customer scalar phone/email fields instead',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
