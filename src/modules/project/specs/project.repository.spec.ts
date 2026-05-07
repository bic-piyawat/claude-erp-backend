import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRepository } from '../project.repository';
import { PrismaService } from '../../../database/prisma.service';

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Alpha ERP',
    status: 'DRAFT',
    ownerId: 'u-1',
    customerId: null,
    stageId: null,
    totalProjectPrice: 100,
    expectedCloseDate: null,
    organizationId: 'org-1',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    owner: {
      id: 'u-1',
      email: 'bic@acme.test',
      firstName: 'Bic',
      lastName: 'Piyawat',
    },
    customer: null,
    stage: null,
    ...overrides,
  };
}

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    projectId: 'proj-1',
    status: 'DRAFT',
    vatRate: 0.07,
    costItems: [],
    ...overrides,
  };
}

describe('ProjectRepository.findAll', () => {
  let repository: ProjectRepository;
  let prisma: {
    project: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    budget: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      budget: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<ProjectRepository>(ProjectRepository);
  });

  it('builds OR clause when search matches project name (PRJ-075)', async () => {
    prisma.project.findMany.mockResolvedValue([projectRow()]);
    prisma.project.count.mockResolvedValue(1);

    await repository.findAll('org-1', 'alpha', undefined, undefined, 1, 20);

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: 'alpha' } },
      { owner: { firstName: { contains: 'alpha' } } },
      { owner: { lastName: { contains: 'alpha' } } },
      { owner: { email: { contains: 'alpha' } } },
      { customer: { name: { contains: 'alpha' } } },
    ]);
  });

  it('builds OR clause matching owner.firstName when search="Bic" (PRJ-075)', async () => {
    prisma.project.findMany.mockResolvedValue([
      projectRow({
        owner: {
          id: 'u-1',
          email: 'bic@acme.test',
          firstName: 'Bic',
          lastName: 'Piyawat',
        },
      }),
    ]);
    prisma.project.count.mockResolvedValue(1);

    const result = await repository.findAll(
      'org-1',
      'Bic',
      undefined,
      undefined,
      1,
      20,
    );

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ owner: { firstName: { contains: 'Bic' } } }]),
    );
    expect(result.data[0].ownerName).toBe('Bic Piyawat');
  });

  it('builds OR clause matching customer.name when search="Acme" (PRJ-075)', async () => {
    prisma.project.findMany.mockResolvedValue([
      projectRow({
        customerId: 'cust-1',
        customer: { id: 'cust-1', name: 'Acme Corp' },
      }),
    ]);
    prisma.project.count.mockResolvedValue(1);

    const result = await repository.findAll(
      'org-1',
      'Acme',
      undefined,
      undefined,
      1,
      20,
    );

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ customer: { name: { contains: 'Acme' } } }]),
    );
    expect(result.data[0].customerName).toBe('Acme Corp');
  });

  it('orders by name asc when sortBy=name, sortDir=asc (PRJ-077)', async () => {
    await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
      undefined,
      'name',
      'asc',
    );

    expect(prisma.project.findMany.mock.calls[0][0].orderBy).toEqual({
      name: 'asc',
    });
  });

  it('orders by totalProjectPrice desc when sortBy=totalProjectPrice (PRJ-077)', async () => {
    await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
      undefined,
      'totalProjectPrice',
      'desc',
    );

    expect(prisma.project.findMany.mock.calls[0][0].orderBy).toEqual({
      totalProjectPrice: 'desc',
    });
  });

  it('sorts by computed totalCost in-memory when sortBy=totalCost (PRJ-077)', async () => {
    prisma.project.findMany.mockResolvedValue([
      projectRow({ id: 'p-cheap' }),
      projectRow({ id: 'p-expensive' }),
    ]);
    prisma.project.count.mockResolvedValue(2);
    prisma.budget.findMany.mockResolvedValue([
      budgetRow({
        id: 'b-cheap',
        projectId: 'p-cheap',
        vatRate: 0,
        costItems: [{ lineTotal: 100, vatIncluded: false }],
      }),
      budgetRow({
        id: 'b-expensive',
        projectId: 'p-expensive',
        vatRate: 0,
        costItems: [{ lineTotal: 5000, vatIncluded: false }],
      }),
    ]);

    const result = await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
      undefined,
      'totalCost',
      'desc',
    );

    expect(result.data.map((p) => p.id)).toEqual(['p-expensive', 'p-cheap']);
    expect(result.data[0].totalCost).toBe(5000);
    expect(result.data[1].totalCost).toBe(100);
  });

  it('filters by customerId (PRJ-075 companion)', async () => {
    await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
      'cust-7',
    );

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.customerId).toBe('cust-7');
  });

  it('returns totalCost=0 for projects without a DRAFT budget (PRJ-074)', async () => {
    prisma.project.findMany.mockResolvedValue([projectRow({ id: 'p-1' })]);
    prisma.project.count.mockResolvedValue(1);
    prisma.budget.findMany.mockResolvedValue([]);

    const result = await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
    );

    expect(result.data[0].totalCost).toBe(0);
  });

  it('computes totalCost as sum of net cost items mixing vatIncluded true/false (PRJ-074)', async () => {
    prisma.project.findMany.mockResolvedValue([projectRow({ id: 'p-1' })]);
    prisma.project.count.mockResolvedValue(1);
    prisma.budget.findMany.mockResolvedValue([
      budgetRow({
        id: 'b-1',
        projectId: 'p-1',
        vatRate: 0.07,
        costItems: [
          { lineTotal: 107, vatIncluded: true }, // net: 100
          { lineTotal: 50, vatIncluded: false }, // net: 50
          { lineTotal: 214, vatIncluded: true }, // net: 200
        ],
      }),
    ]);

    const result = await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
    );

    expect(result.data[0].totalCost).toBe(350);
  });

  it('orders by createdAt desc by default (no sortBy) — unchanged contract', async () => {
    await repository.findAll('org-1', undefined, undefined, undefined, 1, 20);

    expect(prisma.project.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: 'desc',
    });
  });

  it('passes through stageId and ownerId filters', async () => {
    await repository.findAll('org-1', undefined, 'stage-1', 'u-1', 1, 20);

    const where = prisma.project.findMany.mock.calls[0][0].where;
    expect(where.stageId).toBe('stage-1');
    expect(where.ownerId).toBe('u-1');
    expect(where.organizationId).toBe('org-1');
    expect(where.isDeleted).toBe(false);
  });

  it('uses [firstName, lastName] tuple orderBy for sortBy=ownerName (PRJ-077)', async () => {
    await repository.findAll(
      'org-1',
      undefined,
      undefined,
      undefined,
      1,
      20,
      undefined,
      'ownerName',
      'asc',
    );

    expect(prisma.project.findMany.mock.calls[0][0].orderBy).toEqual([
      { owner: { firstName: 'asc' } },
      { owner: { lastName: 'asc' } },
    ]);
  });
});
