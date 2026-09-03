import type { BackupFile } from '@finance/contracts';
import { createTestApp, PREFIX, registerUser, resetDatabase, type TestApp, type TestUser } from './harness';

const civilDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function createAccount(testApp: TestApp, user: TestUser, name = 'Conta principal') {
  return await testApp.prisma.account.create({
    data: {
      userId: user.id,
      name,
      institution: 'Banco de teste',
      type: 'checking',
      initialBalance: 1000,
    },
  });
}

async function previewCsv(testApp: TestApp, user: TestUser, csv: string, fileName = 'extrato.csv') {
  return await user
    .auth(testApp.http.post(`${PREFIX}/imports/preview`))
    .field('origin', 'inter')
    .attach('file', Buffer.from(csv, 'utf8'), fileName)
    .expect(201);
}

async function exportBackup(testApp: TestApp, user: TestUser): Promise<BackupFile> {
  const response = await user.auth(testApp.http.get(`${PREFIX}/backup/export`)).expect(200);
  return response.body as BackupFile;
}

async function seedCompleteGraph(testApp: TestApp, user: TestUser) {
  const account = await createAccount(testApp, user, 'Conta do backup');
  const card = await testApp.prisma.creditCard.create({
    data: {
      userId: user.id,
      name: 'Cartão do backup',
      institution: 'Banco de teste',
      limitTotal: 4000,
      closingDay: 31,
    },
  });
  const category = await testApp.prisma.category.create({
    data: { userId: user.id, name: 'Categoria natural', type: 'expense' },
  });
  const fixed = await testApp.prisma.fixedTransaction.create({
    data: {
      userId: user.id,
      type: 'expense',
      value: 75,
      referenceDay: 29,
      marginDays: 2,
      accountId: account.id,
      categoryId: category.id,
      description: 'Recorrência exportada',
    },
  });
  const fixedTransaction = await testApp.prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'expense',
      value: 76.5,
      date: civilDate('2024-02-29'),
      accountId: account.id,
      categoryId: category.id,
      description: 'Ocorrência confirmada',
      source: 'fixed',
    },
  });
  await testApp.prisma.fixedTransactionOccurrence.create({
    data: {
      fixedTransactionId: fixed.id,
      userId: user.id,
      periodYear: 2024,
      periodMonth: 2,
      status: 'confirmed',
      realDate: civilDate('2024-02-29'),
      dueDate: civilDate('2024-02-29'),
      transactionId: fixedTransaction.id,
      type: 'expense',
      value: 76.5,
      description: 'Ocorrência confirmada',
      categoryId: category.id,
      accountId: account.id,
    },
  });
  await testApp.prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        type: 'income',
        value: 2500,
        date: civilDate('2026-08-05'),
        accountId: account.id,
        description: 'Salário importado',
        source: 'imported',
        externalId: 'backup-external-id-1',
      },
      {
        userId: user.id,
        type: 'expense',
        value: 125.4,
        date: civilDate('2026-08-06'),
        creditCardId: card.id,
        categoryId: category.id,
        description: 'Compra manual',
      },
    ],
  });
  const asset = await testApp.prisma.marketAsset.create({
    data: { userId: user.id, symbol: 'TEST3', type: 'stock', exchange: 'B3', name: 'Ativo de teste' },
  });
  await testApp.prisma.investment.create({
    data: {
      userId: user.id,
      marketAssetId: asset.id,
      broker: 'Corretora de teste',
      type: 'stock',
      quantity: 1.12345678,
      buyPrice: 10.25,
      investedAmount: 11.51,
      buyDate: civilDate('2026-07-01'),
    },
  });
  await testApp.prisma.goal.create({
    data: {
      userId: user.id,
      name: 'Reserva manual',
      type: 'saving',
      targetAmount: 10000,
      currentAmount: 2500,
      deadline: civilDate('2027-12-31'),
      relatedAccountId: account.id,
    },
  });
  await testApp.prisma.importedFile.create({
    data: {
      userId: user.id,
      origin: 'inter',
      fileName: 'historico.csv',
      fileType: 'csv',
      status: 'completed',
      importedAt: new Date('2026-08-05T12:00:00.000Z'),
      totalRecords: 1,
    },
  });

  return { account, card, category, fixed, fixedTransaction, asset };
}

describe('import and backup integration', () => {
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

  it('rejects invalid or tampered selections and imports only the server-stored preview', async () => {
    const user = await registerUser(testApp.http, 'import-validation@example.com');
    const account = await createAccount(testApp, user);

    const invalid = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n31/02/2026;Data impossível;-10,00',
      'invalido.csv',
    );
    expect(invalid.body).toMatchObject({ totalRows: 1, validRows: 0, invalidRows: 1 });
    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${invalid.body.batchId}/confirm`))
      .send({ accountId: account.id, rowNumbers: [1] })
      .expect(400);

    const valid = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n01/04/2026;Valor assinado no arquivo;-10,25',
      'valido.csv',
    );

    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${valid.body.batchId}/confirm`))
      .send({
        accountId: account.id,
        rowNumbers: [1],
        transactions: [{ value: 999999, date: '2030-01-01' }],
      })
      .expect(400);
    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${valid.body.batchId}/confirm`))
      .send({ accountId: account.id, rowNumbers: [999] })
      .expect(400);

    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${valid.body.batchId}/confirm`))
      .send({ accountId: account.id, rowNumbers: [1] })
      .expect(201);

    const stored = await testApp.prisma.transaction.findMany({ where: { userId: user.id, source: 'imported' } });
    expect(stored).toHaveLength(1);
    expect(Number(stored[0].value)).toBe(10.25);
    expect(stored[0].date).toEqual(civilDate('2026-04-01'));
    expect(stored[0].description).toBe('Valor assinado no arquivo');

    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${valid.body.batchId}/confirm`))
      .send({ accountId: account.id })
      .expect(409);

    const repeatedPreview = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n01/04/2026;Valor assinado no arquivo;-10,25',
      'valido.csv',
    );
    expect(repeatedPreview.body).toMatchObject({ validRows: 0, duplicateRows: 1 });
    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${repeatedPreview.body.batchId}/confirm`))
      .send({ accountId: account.id })
      .expect(400);
    expect(await testApp.prisma.transaction.count({ where: { userId: user.id, source: 'imported' } })).toBe(1);
  });

  it('claims a batch once when confirmations race and commits one imported file atomically', async () => {
    const user = await registerUser(testApp.http, 'import-race@example.com');
    const account = await createAccount(testApp, user);
    const preview = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n01/04/2026;Mercado;-150,00\n02/04/2026;Salário;5000,00',
      'concorrente.csv',
    );
    const batchId = preview.body.batchId as string;

    const responses = await Promise.all([
      user
        .auth(testApp.http.post(`${PREFIX}/imports/${batchId}/confirm`))
        .send({ accountId: account.id, rowNumbers: [1, 2] }),
      user
        .auth(testApp.http.post(`${PREFIX}/imports/${batchId}/confirm`))
        .send({ accountId: account.id, rowNumbers: [1, 2] }),
    ]);

    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await testApp.prisma.transaction.count({ where: { userId: user.id, importBatchId: batchId } })).toBe(2);
    expect(await testApp.prisma.importedFile.count({ where: { userId: user.id, batchId } })).toBe(1);
    expect((await testApp.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe('completed');
  });

  it('rolls back the batch claim when its account or card destination was archived', async () => {
    const user = await registerUser(testApp.http, 'archived-import-destinations@example.com');
    const account = await createAccount(testApp, user, 'Conta arquivada');
    const card = await testApp.prisma.creditCard.create({
      data: {
        userId: user.id,
        name: 'Cartão arquivado',
        institution: 'Banco de teste',
        limitTotal: 2500,
        closingDay: 10,
      },
    });
    const accountBatch = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n01/09/2026;Destino conta;-25,00',
      'conta-arquivada.csv',
    );
    const cardBatch = await previewCsv(
      testApp,
      user,
      'Data;Lançamento;Valor\n02/09/2026;Destino cartão;-35,00',
      'cartao-arquivado.csv',
    );

    await user.auth(testApp.http.post(`${PREFIX}/accounts/${account.id}/archive`)).expect(200);
    await user.auth(testApp.http.post(`${PREFIX}/credit-cards/${card.id}/archive`)).expect(200);

    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${accountBatch.body.batchId}/confirm`))
      .send({ accountId: account.id })
      .expect(400);
    await user
      .auth(testApp.http.post(`${PREFIX}/imports/${cardBatch.body.batchId}/confirm`))
      .send({ creditCardId: card.id })
      .expect(400);

    expect(await testApp.prisma.transaction.count({ where: { userId: user.id, source: 'imported' } })).toBe(0);
    expect(await testApp.prisma.importedFile.count({ where: { userId: user.id } })).toBe(0);
    const batches = await testApp.prisma.importBatch.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    expect(batches).toHaveLength(2);
    expect(batches.every((batch) => batch.status === 'pending')).toBe(true);
  });

  it('round-trips the whole graph, makes replace convergent, and deduplicates merge natural keys', async () => {
    const source = await registerUser(testApp.http, 'backup-source@example.com');
    await seedCompleteGraph(testApp, source);
    const sourceBackup = await exportBackup(testApp, source);

    expect(sourceBackup).toMatchObject({
      schemaVersion: 1,
      user: { email: source.email },
    });
    expect(sourceBackup.user).not.toHaveProperty('passwordHash');
    expect(sourceBackup).not.toHaveProperty('refreshTokens');
    expect(sourceBackup.accounts).toHaveLength(1);
    expect(sourceBackup.creditCards).toHaveLength(1);
    expect(sourceBackup.categories).toHaveLength(1);
    expect(sourceBackup.transactions).toHaveLength(3);
    expect(sourceBackup.fixedTransactions).toHaveLength(1);
    expect(sourceBackup.fixedTransactionOccurrences).toHaveLength(1);
    expect(sourceBackup.marketAssets).toHaveLength(1);
    expect(sourceBackup.investments).toHaveLength(1);
    expect(sourceBackup.goals).toHaveLength(1);
    expect(sourceBackup.importedFiles).toHaveLength(1);

    const target = await registerUser(testApp.http, 'backup-target@example.com');
    await createAccount(testApp, target, 'Estado anterior a substituir');

    const firstRestore = await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'replace', data: sourceBackup })
      .expect(200);
    expect(firstRestore.body.created).toMatchObject({
      accounts: 1,
      creditCards: 1,
      categories: 1,
      transactions: 3,
      fixedTransactions: 1,
      fixedTransactionOccurrences: 1,
      marketAssets: 1,
      investments: 1,
      goals: 1,
      importedFiles: 1,
    });
    expect(firstRestore.body.deleted.accounts).toBe(1);

    const afterFirstReplace = await exportBackup(testApp, target);
    expect(afterFirstReplace.user.email).toBe(target.email);
    expect(afterFirstReplace.accounts.map((item) => item.name)).toEqual(['Conta do backup']);
    expect(afterFirstReplace.transactions.map((item) => item.date).sort()).toEqual([
      '2024-02-29',
      '2026-08-05',
      '2026-08-06',
    ]);
    expect(afterFirstReplace.fixedTransactionOccurrences[0]).toMatchObject({
      status: 'confirmed',
      realDate: '2024-02-29',
    });

    await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'replace', data: sourceBackup })
      .expect(200);
    const afterSecondReplace = await exportBackup(testApp, target);
    const ids = (backup: BackupFile) => ({
      accounts: backup.accounts.map((item) => item.id),
      cards: backup.creditCards.map((item) => item.id),
      categories: backup.categories.map((item) => item.id),
      transactions: backup.transactions.map((item) => item.id),
      fixed: backup.fixedTransactions.map((item) => item.id),
      occurrences: backup.fixedTransactionOccurrences.map((item) => item.id),
      assets: backup.marketAssets.map((item) => item.id),
      investments: backup.investments.map((item) => item.id),
      goals: backup.goals.map((item) => item.id),
      importedFiles: backup.importedFiles.map((item) => item.id),
    });
    expect(ids(afterSecondReplace)).toEqual(ids(afterFirstReplace));

    const firstMerge = await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'merge', data: sourceBackup })
      .expect(200);
    expect(firstMerge.body.created.categories).toBe(0);
    expect(firstMerge.body.created.marketAssets).toBe(0);
    expect(firstMerge.body.created.transactions).toBe(2);

    const secondMerge = await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'merge', data: sourceBackup })
      .expect(200);
    expect(secondMerge.body.created.categories).toBe(0);
    expect(secondMerge.body.created.marketAssets).toBe(0);

    expect(
      await testApp.prisma.category.count({
        where: { userId: target.id, name: 'Categoria natural', type: 'expense' },
      }),
    ).toBe(1);
    expect(
      await testApp.prisma.marketAsset.count({
        where: { userId: target.id, symbol: 'TEST3', exchange: 'B3' },
      }),
    ).toBe(1);
    expect(
      await testApp.prisma.transaction.count({
        where: { userId: target.id, externalId: 'backup-external-id-1' },
      }),
    ).toBe(1);
  });

  it('keeps confirmed occurrences linked when merge reuses a transaction by externalId', async () => {
    const source = await registerUser(testApp.http, 'backup-occurrence-source@example.com');
    await seedCompleteGraph(testApp, source);
    const sourceBackup = await exportBackup(testApp, source);
    const confirmedOccurrence = sourceBackup.fixedTransactionOccurrences.find(
      (occurrence) => occurrence.status === 'confirmed',
    );
    const linkedTransaction = sourceBackup.transactions.find(
      (transaction) => transaction.id === confirmedOccurrence?.transactionId,
    );
    expect(linkedTransaction).toBeDefined();
    if (!linkedTransaction) throw new Error('fixture sem transação confirmada');
    linkedTransaction.externalId = 'backup-confirmed-occurrence-1';

    const target = await registerUser(testApp.http, 'backup-occurrence-target@example.com');
    const existingState = structuredClone(sourceBackup);
    existingState.fixedTransactionOccurrences = [];
    await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'replace', data: existingState })
      .expect(200);
    const existing = await testApp.prisma.transaction.findFirstOrThrow({
      where: { userId: target.id, externalId: linkedTransaction.externalId },
      select: { id: true },
    });

    const merge = await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'merge', data: sourceBackup })
      .expect(200);
    const repeatedMerge = await target
      .auth(testApp.http.post(`${PREFIX}/backup/restore`))
      .send({ mode: 'merge', data: sourceBackup })
      .expect(200);

    expect(merge.body.created.fixedTransactionOccurrences).toBe(1);
    expect(repeatedMerge.body.created.fixedTransactionOccurrences).toBe(0);
    expect(
      await testApp.prisma.transaction.count({
        where: { userId: target.id, externalId: linkedTransaction.externalId },
      }),
    ).toBe(1);
    const confirmed = await testApp.prisma.fixedTransactionOccurrence.findMany({
      where: { userId: target.id, status: 'confirmed' },
      select: { transactionId: true },
    });
    expect(confirmed).toEqual([{ transactionId: existing.id }]);
  });

  it('rolls back a replace restore when PostgreSQL rejects a write after the purge starts', async () => {
    const source = await registerUser(testApp.http, 'rollback-source@example.com');
    await createAccount(testApp, source, 'Conta nova do arquivo');
    const backup = await exportBackup(testApp, source);

    const target = await registerUser(testApp.http, 'rollback-target@example.com');
    const sentinel = await createAccount(testApp, target, 'Conta que deve sobreviver');

    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_reject_restore_account()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.user_id = '${target.id}' THEN
          RAISE EXCEPTION 'forced restore failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_reject_restore_account_trigger
      BEFORE INSERT ON accounts
      FOR EACH ROW EXECUTE FUNCTION test_reject_restore_account()
    `);

    try {
      await target
        .auth(testApp.http.post(`${PREFIX}/backup/restore`))
        .send({ mode: 'replace', data: backup })
        .expect(500);
    } finally {
      await testApp.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_reject_restore_account_trigger ON accounts');
      await testApp.prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_reject_restore_account()');
    }

    const targetAccounts = await testApp.prisma.account.findMany({ where: { userId: target.id } });
    expect(targetAccounts).toHaveLength(1);
    expect(targetAccounts[0]).toMatchObject({ id: sentinel.id, name: 'Conta que deve sobreviver' });
  });
});
