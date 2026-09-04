import { createTestApp, PREFIX, registerUser, resetDatabase, type TestApp } from './harness';

describe('Category colors and movement search', () => {
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

  it('persists color, validates hex in HTTP and PostgreSQL, and preserves tenant boundaries', async () => {
    const user = await registerUser(testApp.http);
    const other = await registerUser(testApp.http);
    const response = await user
      .auth(testApp.http.post(`${PREFIX}/categories`))
      .send({ name: 'Educação', type: 'expense', color: '#a78bfa' })
      .expect(201);
    const id = response.body.id as string;
    expect((await testApp.prisma.category.findUniqueOrThrow({ where: { id } })).color).toBe('#a78bfa');
    await other
      .auth(testApp.http.patch(`${PREFIX}/categories/${id}`))
      .send({ color: '#60a5fa' })
      .expect(404);
    await user
      .auth(testApp.http.patch(`${PREFIX}/categories/${id}`))
      .send({ color: 'blue' })
      .expect(400);
    await expect(testApp.prisma.category.update({ where: { id }, data: { color: '#abc' } })).rejects.toThrow();
    await user
      .auth(testApp.http.patch(`${PREFIX}/categories/${id}`))
      .send({ color: null })
      .expect(200);
    expect((await testApp.prisma.category.findUniqueOrThrow({ where: { id } })).color).toBeNull();
  });

  it('searches all category pages and filters archived categories before counting', async () => {
    const user = await registerUser(testApp.http);
    await testApp.prisma.category.createMany({
      data: Array.from({ length: 105 }, (_, index) => ({
        userId: user.id,
        name: `Categoria ${index}`,
        type: 'expense',
        isActive: index % 2 === 0,
      })),
    });
    const archived = await user
      .auth(
        testApp.http.get(`${PREFIX}/categories`).query({ status: 'archived', search: 'categoria', page: 2, limit: 20 }),
      )
      .expect(200);
    expect(archived.body.meta.totalItems).toBe(52);
    expect(archived.body.data).toHaveLength(20);
    expect(archived.body.data.every((category: { isActive: boolean }) => !category.isActive)).toBe(true);
    const searched = await user
      .auth(testApp.http.get(`${PREFIX}/categories`).query({ status: 'all', search: 'CATEGORIA 104' }))
      .expect(200);
    expect(searched.body.meta.totalItems).toBe(1);
    expect(searched.body.data[0].name).toBe('Categoria 104');
  });

  it('finds transactions beyond the first 100 records and does not include another user', async () => {
    const user = await registerUser(testApp.http);
    const other = await registerUser(testApp.http);
    for (const owner of [user, other]) {
      const account = await testApp.prisma.account.create({
        data: { userId: owner.id, name: 'Principal', institution: 'Local', type: 'checking', initialBalance: 0 },
      });
      await testApp.prisma.transaction.createMany({
        data: Array.from({ length: 105 }, (_, index) => ({
          userId: owner.id,
          accountId: account.id,
          type: 'expense',
          value: 10,
          date: new Date('2026-09-01T00:00:00.000Z'),
          description: `Mercado ${index}`,
        })),
      });
    }
    const response = await user
      .auth(testApp.http.get(`${PREFIX}/transactions`).query({ search: 'MERCADO 104', page: 1, limit: 20 }))
      .expect(200);
    expect(response.body.meta.totalItems).toBe(1);
    expect(response.body.data[0].description).toBe('Mercado 104');
  });
});
