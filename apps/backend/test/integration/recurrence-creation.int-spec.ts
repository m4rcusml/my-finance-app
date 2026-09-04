import { todayIn } from '../../src/common/civil-date';
import { FixedTransactionsJob } from '../../src/jobs/fixed-transactions.job';
import { createTestApp, PREFIX, registerUser, resetDatabase, type TestApp } from './harness';

describe('immediate recurring occurrences', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });
  afterAll(async () => {
    await testApp.close();
  });

  it('exposes the current occurrence immediately and preserves it across restore/cron races', async () => {
    const user = await registerUser(testApp.http);
    const account = await testApp.prisma.account.create({
      data: { userId: user.id, name: 'Principal', institution: 'Teste', type: 'checking', initialBalance: 0 },
    });
    const category = await testApp.prisma.category.create({
      data: { userId: user.id, name: 'Moradia', type: 'expense' },
    });
    const response = await user
      .auth(testApp.http.post(`${PREFIX}/fixed-transactions`))
      .send({
        type: 'expense',
        value: 100,
        referenceDay: 15,
        categoryId: category.id,
        accountId: account.id,
        description: 'Aluguel',
      })
      .expect(201);
    const fixedId: string = response.body.id;
    const today = todayIn('America/Sao_Paulo');
    const [year, month] = today.split('-').map(Number);
    const filter = { fixedTransactionId: fixedId, periodYear: year, periodMonth: month };
    const initial = await testApp.prisma.fixedTransactionOccurrence.findFirstOrThrow({ where: filter });
    expect(initial.status).toBe('pending');
    expect(await testApp.prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    const listing = await user
      .auth(testApp.http.get(`${PREFIX}/fixed-transactions/occurrences?year=${year}&month=${month}`))
      .expect(200);
    expect(listing.body.data).toEqual([expect.objectContaining({ id: initial.id, status: 'pending' })]);

    await user.auth(testApp.http.post(`${PREFIX}/fixed-transactions/occurrences/${initial.id}/skip`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/fixed-transactions/${fixedId}/archive`)).expect(201);
    const results = await Promise.all([
      user.auth(testApp.http.post(`${PREFIX}/fixed-transactions/${fixedId}/restore`)),
      user.auth(testApp.http.post(`${PREFIX}/fixed-transactions/${fixedId}/restore`)),
      testApp.app.get(FixedTransactionsJob).run(today),
    ]);
    expect(results[0].status).toBe(201);
    expect(results[1].status).toBe(201);
    await testApp.app.get(FixedTransactionsJob).run(today);
    const final = await testApp.prisma.fixedTransactionOccurrence.findMany({ where: filter });
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ id: initial.id, status: 'skipped', transactionId: null });
    expect(await testApp.prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
  });
});
