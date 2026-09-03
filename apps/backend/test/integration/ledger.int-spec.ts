import { billingCycleFor } from '../../src/common/civil-date';
import {
  createTestApp,
  expectPaginated,
  PREFIX,
  registerUser,
  resetDatabase,
  type TestApp,
  type TestUser,
} from './harness';

const civilDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function createAccount(testApp: TestApp, user: TestUser, name = 'Conta principal') {
  const response = await user
    .auth(testApp.http.post(`${PREFIX}/accounts`))
    .send({
      name,
      institution: 'Banco de teste',
      type: 'checking',
      initialBalance: 1000,
    })
    .expect(201);
  return response.body as { id: string };
}

async function createCategory(testApp: TestApp, user: TestUser, name = 'Mercado') {
  const response = await user
    .auth(testApp.http.post(`${PREFIX}/categories`))
    .send({ name, type: 'expense' })
    .expect(201);
  return response.body as { id: string };
}

async function createCard(testApp: TestApp, user: TestUser, name = 'Cartão principal', closingDay = 10) {
  const response = await user
    .auth(testApp.http.post(`${PREFIX}/credit-cards`))
    .send({
      name,
      institution: 'Banco de teste',
      limitTotal: 5000,
      closingDay,
    })
    .expect(201);
  return response.body as { id: string };
}

describe('ledger integration', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    jest.useRealTimers();
    await resetDatabase(testApp.prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('keeps the 1-based pagination contract at 0, 1, 20, 21 and more than 100 rows', async () => {
    const user = await registerUser(testApp.http, 'pagination@example.com');
    const account = await testApp.prisma.account.create({
      data: {
        userId: user.id,
        name: 'Conta de paginação',
        institution: 'Banco de teste',
        type: 'checking',
        initialBalance: 0,
      },
    });

    for (const count of [0, 1, 20, 21, 105]) {
      await testApp.prisma.transaction.deleteMany({ where: { userId: user.id } });
      if (count > 0) {
        await testApp.prisma.transaction.createMany({
          data: Array.from({ length: count }, (_, index) => ({
            userId: user.id,
            type: 'expense' as const,
            value: index + 0.01,
            date: civilDate('2026-08-15'),
            accountId: account.id,
            description: `Lançamento ${String(index + 1).padStart(3, '0')}`,
          })),
        });
      }

      const limit = count > 100 ? 100 : 20;
      const firstResponse = await user
        .auth(testApp.http.get(`${PREFIX}/transactions?page=1&limit=${limit}`))
        .expect(200);
      const first = expectPaginated<{ id: string }>(firstResponse.body);
      const totalPages = count === 0 ? 0 : Math.ceil(count / limit);

      expect(first.data).toHaveLength(Math.min(count, limit));
      expect(first.meta).toEqual({
        page: 1,
        limit,
        totalItems: count,
        totalPages,
        hasPreviousPage: false,
        hasNextPage: totalPages > 1,
      });

      if (count > limit) {
        const secondResponse = await user
          .auth(testApp.http.get(`${PREFIX}/transactions?page=2&limit=${limit}`))
          .expect(200);
        const second = expectPaginated<{ id: string }>(secondResponse.body);
        expect(second.data).toHaveLength(count - limit);
        expect(second.meta).toMatchObject({
          page: 2,
          limit,
          totalItems: count,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        });
        expect(new Set([...first.data, ...second.data].map((item) => item.id)).size).toBe(count);
      }
    }

    await user.auth(testApp.http.get(`${PREFIX}/transactions?limit=101`)).expect(400);
    await user.auth(testApp.http.get(`${PREFIX}/transactions?page=0`)).expect(400);
  });

  it('returns 404 across tenants and never lets a foreign relation become a write destination', async () => {
    const owner = await registerUser(testApp.http, 'owner@example.com');
    const intruder = await registerUser(testApp.http, 'intruder@example.com');
    const account = await createAccount(testApp, owner);
    const category = await createCategory(testApp, owner);

    const created = await owner
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'expense',
        value: 89.9,
        date: '2026-09-03',
        accountId: account.id,
        categoryId: category.id,
        description: 'Somente do proprietário',
      })
      .expect(201);
    const transactionId = (created.body as { id: string }).id;

    await intruder.auth(testApp.http.get(`${PREFIX}/transactions/${transactionId}`)).expect(404);
    await intruder
      .auth(testApp.http.patch(`${PREFIX}/transactions/${transactionId}`))
      .send({ description: 'tentativa de alteração' })
      .expect(404);
    await intruder.auth(testApp.http.delete(`${PREFIX}/transactions/${transactionId}`)).expect(404);

    await intruder
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'expense',
        value: 1,
        date: '2026-09-03',
        accountId: account.id,
        categoryId: category.id,
      })
      .expect(404);

    const intruderList = expectPaginated(
      (await intruder.auth(testApp.http.get(`${PREFIX}/transactions`)).expect(200)).body,
    );
    expect(intruderList.data).toHaveLength(0);
    expect(await testApp.prisma.transaction.count({ where: { userId: owner.id } })).toBe(1);
  });

  it('refuses archived account, card and category in manual creates and relation changes', async () => {
    const user = await registerUser(testApp.http, 'archived-manual-relations@example.com');
    const activeAccount = await createAccount(testApp, user, 'Conta ativa');
    const archivedAccount = await createAccount(testApp, user, 'Conta arquivada');
    const archivedCard = await createCard(testApp, user, 'Cartão arquivado');
    const activeCategory = await createCategory(testApp, user, 'Categoria ativa');
    const archivedCategory = await createCategory(testApp, user, 'Categoria arquivada');

    const existing = await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'expense',
        value: 25,
        date: '2026-09-03',
        accountId: activeAccount.id,
        categoryId: activeCategory.id,
      })
      .expect(201);

    await user.auth(testApp.http.post(`${PREFIX}/accounts/${archivedAccount.id}/archive`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/credit-cards/${archivedCard.id}/archive`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/categories/${archivedCategory.id}/archive`)).expect(200);

    await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({ type: 'expense', value: 1, date: '2026-09-04', accountId: archivedAccount.id })
      .expect(400);
    await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({ type: 'expense', value: 1, date: '2026-09-04', creditCardId: archivedCard.id })
      .expect(400);
    await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'expense',
        value: 1,
        date: '2026-09-04',
        accountId: activeAccount.id,
        categoryId: archivedCategory.id,
      })
      .expect(400);

    await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'income',
        value: 1,
        date: '2026-09-04',
        accountId: activeAccount.id,
        categoryId: activeCategory.id,
      })
      .expect(400);

    await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${existing.body.id}`))
      .send({ type: 'income' })
      .expect(400);

    await user
      .auth(testApp.http.patch(`${PREFIX}/categories/${activeCategory.id}`))
      .send({ type: 'income' })
      .expect(409);

    await user
      .auth(testApp.http.post(`${PREFIX}/fixed-transactions`))
      .send({
        type: 'expense',
        value: 50,
        referenceDay: 15,
        accountId: archivedAccount.id,
        categoryId: activeCategory.id,
      })
      .expect(400);

    await user
      .auth(testApp.http.post(`${PREFIX}/fixed-transactions`))
      .send({
        type: 'expense',
        value: 50,
        referenceDay: 15,
        accountId: activeAccount.id,
        categoryId: archivedCategory.id,
      })
      .expect(400);

    await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${existing.body.id}`))
      .send({ accountId: archivedAccount.id })
      .expect(400);
    await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${existing.body.id}`))
      .send({ accountId: null, creditCardId: archivedCard.id })
      .expect(400);
    await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${existing.body.id}`))
      .send({ categoryId: archivedCategory.id })
      .expect(400);

    expect(await testApp.prisma.transaction.count({ where: { userId: user.id } })).toBe(1);
    expect(await testApp.prisma.fixedTransaction.count({ where: { userId: user.id } })).toBe(0);
    await expect(
      testApp.prisma.transaction.findUniqueOrThrow({ where: { id: existing.body.id } }),
    ).resolves.toMatchObject({
      accountId: activeAccount.id,
      creditCardId: null,
      categoryId: activeCategory.id,
    });
  });

  it('atomically switches account to card, preserves civil dates across database timezones, and accepts leap day', async () => {
    const user = await registerUser(testApp.http, 'civil-date@example.com');
    const account = await createAccount(testApp, user);
    const card = await createCard(testApp, user);

    const created = await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({
        type: 'expense',
        value: 42.35,
        date: '2024-02-29',
        accountId: account.id,
      })
      .expect(201);
    const id = (created.body as { id: string }).id;

    const switched = await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${id}`))
      .send({ accountId: null, creditCardId: card.id })
      .expect(200);

    expect(switched.body).toMatchObject({
      id,
      date: '2024-02-29',
      accountId: null,
      creditCardId: card.id,
    });

    const readDateIn = async (timeZone: string) =>
      await testApp.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${timeZone}'`);
        const rows = await tx.$queryRawUnsafe<{ date: string }[]>(
          'SELECT date::text AS date FROM transactions WHERE id = $1',
          id,
        );
        return rows[0]?.date;
      });

    expect(await readDateIn('Pacific/Kiritimati')).toBe('2024-02-29');
    expect(await readDateIn('America/Los_Angeles')).toBe('2024-02-29');

    const exactDay = expectPaginated<{ id: string; date: string }>(
      (await user.auth(testApp.http.get(`${PREFIX}/transactions?fromDate=2024-02-29&toDate=2024-02-29`)).expect(200))
        .body,
    );
    expect(exactDay.data).toEqual([expect.objectContaining({ id, date: '2024-02-29' })]);

    await user
      .auth(testApp.http.patch(`${PREFIX}/transactions/${id}`))
      .send({ accountId: account.id })
      .expect(400);
    await user
      .auth(testApp.http.post(`${PREFIX}/transactions`))
      .send({ type: 'expense', value: 1, date: '2023-02-29', accountId: account.id })
      .expect(400);
  });

  it('computes open card cycles for closing days 28, 29, 30 and 31 in a leap year', async () => {
    const user = await registerUser(testApp.http, 'card-cycle@example.com');
    const expectedCycles = new Map([
      [28, { start: '2024-02-29', end: '2024-03-28' }],
      [29, { start: '2024-01-30', end: '2024-02-29' }],
      [30, { start: '2024-01-31', end: '2024-02-29' }],
      [31, { start: '2024-02-01', end: '2024-02-29' }],
    ]);

    expect(billingCycleFor('2024-02-29', 31)).toEqual({ start: '2024-02-01', end: '2024-02-29' });

    const cards: { id: string; closingDay: number }[] = [];
    for (const closingDay of [28, 29, 30, 31]) {
      const card = await testApp.prisma.creditCard.create({
        data: {
          userId: user.id,
          name: `Cartão fecha ${closingDay}`,
          institution: 'Banco de teste',
          limitTotal: 1000,
          closingDay,
        },
      });
      cards.push({ id: card.id, closingDay });

      const cycle = expectedCycles.get(closingDay);
      if (!cycle) throw new Error(`missing expected cycle for ${closingDay}`);
      const before = new Date(civilDate(cycle.start));
      before.setUTCDate(before.getUTCDate() - 1);
      const after = new Date(civilDate(cycle.end));
      after.setUTCDate(after.getUTCDate() + 1);
      await testApp.prisma.transaction.createMany({
        data: [
          { userId: user.id, type: 'expense', value: 10, date: civilDate(cycle.start), creditCardId: card.id },
          { userId: user.id, type: 'expense', value: 20, date: civilDate(cycle.end), creditCardId: card.id },
          { userId: user.id, type: 'expense', value: 40, date: before, creditCardId: card.id },
          { userId: user.id, type: 'expense', value: 80, date: after, creditCardId: card.id },
          { userId: user.id, type: 'income', value: 160, date: civilDate(cycle.start), creditCardId: card.id },
        ],
      });
    }

    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-02-29T15:00:00.000Z'));

    for (const card of cards) {
      const response = await user.auth(testApp.http.get(`${PREFIX}/credit-cards/${card.id}`)).expect(200);
      expect(response.body).toMatchObject({
        currentCycle: expectedCycles.get(card.closingDay),
        cycleUsedAmount: 30,
        availableAmount: 970,
      });
    }
  });

  it('confirms one recurrence exactly once under concurrent HTTP requests', async () => {
    const user = await registerUser(testApp.http, 'recurrence-race@example.com');
    const account = await createAccount(testApp, user);
    const category = await createCategory(testApp, user, 'Assinaturas');

    const fixedResponse = await user
      .auth(testApp.http.post(`${PREFIX}/fixed-transactions`))
      .send({
        type: 'expense',
        value: 99.9,
        referenceDay: 29,
        marginDays: 0,
        accountId: account.id,
        categoryId: category.id,
        description: 'Serviço recorrente',
      })
      .expect(201);
    const fixedId = (fixedResponse.body as { id: string }).id;

    const occurrence = await testApp.prisma.fixedTransactionOccurrence.create({
      data: {
        fixedTransactionId: fixedId,
        userId: user.id,
        periodYear: 2024,
        periodMonth: 2,
        dueDate: civilDate('2024-02-29'),
        type: 'expense',
        value: 99.9,
        description: 'Serviço recorrente',
        categoryId: category.id,
        accountId: account.id,
      },
    });

    const responses = await Promise.all([
      user
        .auth(testApp.http.post(`${PREFIX}/fixed-transactions/occurrences/${occurrence.id}/confirm`))
        .send({ realDate: '2024-02-29', value: 101.25 }),
      user
        .auth(testApp.http.post(`${PREFIX}/fixed-transactions/occurrences/${occurrence.id}/confirm`))
        .send({ realDate: '2024-02-29', value: 101.25 }),
    ]);

    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);

    const storedOccurrence = await testApp.prisma.fixedTransactionOccurrence.findUniqueOrThrow({
      where: { id: occurrence.id },
    });
    const transactions = await testApp.prisma.transaction.findMany({
      where: { userId: user.id, source: 'fixed' },
    });

    expect(transactions).toHaveLength(1);
    expect(storedOccurrence).toMatchObject({
      status: 'confirmed',
      transactionId: transactions[0].id,
      realDate: civilDate('2024-02-29'),
    });
    expect(Number(transactions[0].value)).toBe(101.25);
  });

  it('keeps occurrences pending when their snapshotted account, card or category was archived', async () => {
    const user = await registerUser(testApp.http, 'archived-occurrence-relations@example.com');

    const seedOccurrence = async (source: 'account' | 'card', suffix: string) => {
      const account = source === 'account' ? await createAccount(testApp, user, `Conta ${suffix}`) : null;
      const card = source === 'card' ? await createCard(testApp, user, `Cartão ${suffix}`) : null;
      const category = await createCategory(testApp, user, `Categoria ${suffix}`);
      const fixed = await testApp.prisma.fixedTransaction.create({
        data: {
          userId: user.id,
          type: 'expense',
          value: 50,
          referenceDay: 15,
          marginDays: 0,
          accountId: account?.id ?? null,
          creditCardId: card?.id ?? null,
          categoryId: category.id,
          description: `Recorrência ${suffix}`,
        },
      });
      const occurrence = await testApp.prisma.fixedTransactionOccurrence.create({
        data: {
          fixedTransactionId: fixed.id,
          userId: user.id,
          periodYear: 2026,
          periodMonth: 9,
          dueDate: civilDate('2026-09-15'),
          type: 'expense',
          value: 50,
          accountId: account?.id ?? null,
          creditCardId: card?.id ?? null,
          categoryId: category.id,
          description: `Recorrência ${suffix}`,
        },
      });
      return { account, card, category, occurrence };
    };

    const archivedAccount = await seedOccurrence('account', 'conta');
    const archivedCard = await seedOccurrence('card', 'cartão');
    const archivedCategory = await seedOccurrence('account', 'categoria');

    await user.auth(testApp.http.post(`${PREFIX}/accounts/${archivedAccount.account?.id}/archive`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/credit-cards/${archivedCard.card?.id}/archive`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/categories/${archivedCategory.category.id}/archive`)).expect(200);

    for (const occurrenceId of [
      archivedAccount.occurrence.id,
      archivedCard.occurrence.id,
      archivedCategory.occurrence.id,
    ]) {
      await user
        .auth(testApp.http.post(`${PREFIX}/fixed-transactions/occurrences/${occurrenceId}/confirm`))
        .send({ realDate: '2026-09-15' })
        .expect(400);
    }

    expect(await testApp.prisma.transaction.count({ where: { userId: user.id, source: 'fixed' } })).toBe(0);
    const occurrences = await testApp.prisma.fixedTransactionOccurrence.findMany({
      where: { userId: user.id },
      orderBy: { id: 'asc' },
    });
    expect(occurrences).toHaveLength(3);
    expect(
      occurrences.every((occurrence) => occurrence.status === 'pending' && occurrence.transactionId === null),
    ).toBe(true);
  });
});
