import { Test, TestingModule } from '@nestjs/testing';
import { ContactPersonRepository } from '../contact-person.repository';
import { PrismaService } from '../../../database/prisma.service';

describe('ContactPersonRepository', () => {
  let repository: ContactPersonRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      contactPerson: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactPersonRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<ContactPersonRepository>(ContactPersonRepository);
  });

  describe('findById', () => {
    it('queries by id, organizationId, and isDeleted=false', async () => {
      (prisma.contactPerson.findFirst as jest.Mock).mockResolvedValue({
        id: 'cp-1',
      });

      await repository.findById('cp-1', 'org-1');

      const call = (prisma.contactPerson.findFirst as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toEqual({
        id: 'cp-1',
        organizationId: 'org-1',
        isDeleted: false,
      });
      expect(call.select).toBeDefined();
    });
  });

  describe('findAllByCustomer', () => {
    it('filters by customerId, organizationId, isDeleted=false, ordered by createdAt asc', async () => {
      (prisma.contactPerson.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findAllByCustomer('cust-1', 'org-1');

      const call = (prisma.contactPerson.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toEqual({
        customerId: 'cust-1',
        organizationId: 'org-1',
        isDeleted: false,
      });
      expect(call.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('create', () => {
    it('creates a contact with default isPrimary=false when not supplied', async () => {
      (prisma.contactPerson.create as jest.Mock).mockResolvedValue({
        id: 'cp-1',
      });

      await repository.create({
        customerId: 'cust-1',
        organizationId: 'org-1',
        name: 'Jane Doe',
      });

      const call = (prisma.contactPerson.create as jest.Mock).mock.calls[0][0];
      expect(call.data.customerId).toBe('cust-1');
      expect(call.data.organizationId).toBe('org-1');
      expect(call.data.name).toBe('Jane Doe');
      expect(call.data.isPrimary).toBe(false);
    });

    it('passes through optional fields and explicit isPrimary=true', async () => {
      (prisma.contactPerson.create as jest.Mock).mockResolvedValue({
        id: 'cp-1',
      });

      await repository.create({
        customerId: 'cust-1',
        organizationId: 'org-1',
        name: 'Jane Doe',
        position: 'CFO',
        phone: '0812345678',
        email: 'jane@example.com',
        isPrimary: true,
      });

      const call = (prisma.contactPerson.create as jest.Mock).mock.calls[0][0];
      expect(call.data.position).toBe('CFO');
      expect(call.data.phone).toBe('0812345678');
      expect(call.data.email).toBe('jane@example.com');
      expect(call.data.isPrimary).toBe(true);
    });
  });

  describe('update', () => {
    it('forwards data to prisma.update keyed by id', async () => {
      (prisma.contactPerson.update as jest.Mock).mockResolvedValue({
        id: 'cp-1',
      });

      await repository.update('cp-1', { name: 'Renamed', isPrimary: true });

      const call = (prisma.contactPerson.update as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'cp-1' });
      expect(call.data).toEqual({ name: 'Renamed', isPrimary: true });
    });
  });

  describe('softDelete', () => {
    it('sets isDeleted=true on the row', async () => {
      (prisma.contactPerson.update as jest.Mock).mockResolvedValue({
        id: 'cp-1',
      });

      await repository.softDelete('cp-1');

      expect(prisma.contactPerson.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { isDeleted: true },
      });
    });
  });
});
