import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Development seed — **fully idempotent**.
 *
 * Every row is written with a fixed id through `upsert`, so running
 * `pnpm db:seed` any number of times converges to the same dataset instead of
 * duplicating transactions on every run (the previous seed used bare `create`
 * for eight rows).
 *
 * This creates demo data only. Never run it against a production database.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set. Copy apps/backend/.env.example to .env first.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'senha-demo-12345';

/** Civil date helpers — the seed writes `YYYY-MM-DD` into `@db.Date` columns. */
const civil = (value: string) => new Date(`${value}T00:00:00.000Z`);
const pad = (n: number) => String(n).padStart(2, '0');

function monthsAgo(reference: Date, months: number): { year: number; month: number } {
  const zero = reference.getUTCFullYear() * 12 + reference.getUTCMonth() - months;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

async function main() {
  // A fixed "today" would make the data drift out of the dashboard window, so
  // the seed anchors on the real current month but writes deterministic ids.
  const now = new Date();
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Usuário Demo' },
    create: { id: 'seed-user-1', email: DEMO_EMAIL, passwordHash, name: 'Usuário Demo' },
  });

  const accounts = await Promise.all(
    (
      [
        ['seed-account-checking', 'Conta Corrente', 'Banco Inter', 'checking', 5000],
        ['seed-account-savings', 'Poupança', 'Nubank', 'savings', 10000],
        ['seed-account-invest', 'Corretora', 'XP', 'investment', 20000],
      ] as const
    ).map(([id, name, institution, type, initialBalance]) =>
      prisma.account.upsert({
        where: { id },
        update: { name, institution, type, initialBalance },
        create: { id, userId: user.id, name, institution, type, initialBalance },
      }),
    ),
  );
  const [checking, , investAccount] = accounts;

  const card = await prisma.creditCard.upsert({
    where: { id: 'seed-card-inter' },
    update: { name: 'Cartão Inter', institution: 'Banco Inter', limitTotal: 8000, closingDay: 10 },
    create: {
      id: 'seed-card-inter',
      userId: user.id,
      name: 'Cartão Inter',
      institution: 'Banco Inter',
      limitTotal: 8000,
      closingDay: 10,
    },
  });

  const categorySpecs = [
    ['seed-cat-food', 'Alimentação', 'expense'],
    ['seed-cat-transport', 'Transporte', 'expense'],
    ['seed-cat-housing', 'Moradia', 'expense'],
    ['seed-cat-salary', 'Salário', 'income'],
    ['seed-cat-other', 'Outros', 'both'],
  ] as const;

  const categories = await Promise.all(
    categorySpecs.map(([id, name, type]) =>
      prisma.category.upsert({
        where: { id },
        update: { name, type },
        create: { id, userId: user.id, name, type },
      }),
    ),
  );
  const byName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // Six months of transactions — enough for the 12-month chart to show movement
  // and, crucially, MORE THAN 20 rows in the current month so a truncated
  // aggregate would be visible immediately in the UI.
  const transactions: {
    id: string;
    type: 'income' | 'expense';
    value: number;
    date: Date;
    accountId?: string;
    creditCardId?: string;
    categoryId: string;
    description: string;
  }[] = [];

  for (let back = 5; back >= 0; back -= 1) {
    const { year, month } = monthsAgo(now, back);
    const prefix = `${year}-${pad(month)}`;

    transactions.push({
      id: `seed-tx-salary-${prefix}`,
      type: 'income',
      value: 7500,
      date: civil(`${prefix}-05`),
      accountId: checking.id,
      categoryId: byName['Salário'].id,
      description: 'Salário mensal',
    });
    transactions.push({
      id: `seed-tx-rent-${prefix}`,
      type: 'expense',
      value: 2200,
      date: civil(`${prefix}-10`),
      accountId: checking.id,
      categoryId: byName['Moradia'].id,
      description: 'Aluguel',
    });

    // 24 small card purchases in the CURRENT month, 6 in earlier months.
    const purchases = back === 0 ? 24 : 6;
    for (let i = 1; i <= purchases; i += 1) {
      transactions.push({
        id: `seed-tx-market-${prefix}-${pad(i)}`,
        type: 'expense',
        value: Number((37.5 + i * 3.25).toFixed(2)),
        date: civil(`${prefix}-${pad(Math.min(28, i))}`),
        creditCardId: card.id,
        categoryId: byName[i % 3 === 0 ? 'Transporte' : 'Alimentação'].id,
        description: i % 3 === 0 ? `Corrida de app ${i}` : `Mercado ${i}`,
      });
    }
  }

  // One deliberately uncategorised row so /transactions/uncategorized is not empty.
  const currentPrefix = (() => {
    const { year, month } = monthsAgo(now, 0);
    return `${year}-${pad(month)}`;
  })();

  for (const tx of transactions) {
    const { id, ...rest } = tx;
    await prisma.transaction.upsert({
      where: { id },
      update: { ...rest, userId: user.id },
      create: { id, userId: user.id, ...rest },
    });
  }

  await prisma.transaction.upsert({
    where: { id: 'seed-tx-uncategorized' },
    update: {},
    create: {
      id: 'seed-tx-uncategorized',
      userId: user.id,
      type: 'expense',
      value: 129.9,
      date: civil(`${currentPrefix}-15`),
      accountId: checking.id,
      description: 'Compra sem categoria',
    },
  });

  const template = await prisma.fixedTransaction.upsert({
    where: { id: 'seed-fixed-rent' },
    update: {},
    create: {
      id: 'seed-fixed-rent',
      userId: user.id,
      type: 'expense',
      value: 2200,
      referenceDay: 10,
      marginDays: 3,
      accountId: checking.id,
      categoryId: byName['Moradia'].id,
      description: 'Aluguel mensal',
    },
  });

  const { year: curYear, month: curMonth } = monthsAgo(now, 0);
  const dueDay = Math.min(template.referenceDay, new Date(Date.UTC(curYear, curMonth, 0)).getUTCDate());
  await prisma.fixedTransactionOccurrence.upsert({
    where: {
      fixedTransactionId_periodYear_periodMonth: {
        fixedTransactionId: template.id,
        periodYear: curYear,
        periodMonth: curMonth,
      },
    },
    update: {},
    create: {
      id: `seed-occ-${curYear}-${pad(curMonth)}`,
      fixedTransactionId: template.id,
      userId: user.id,
      periodYear: curYear,
      periodMonth: curMonth,
      status: 'pending',
      dueDate: civil(`${curYear}-${pad(curMonth)}-${pad(dueDay)}`),
      type: template.type,
      value: template.value,
      description: template.description,
      categoryId: template.categoryId,
      accountId: template.accountId,
      creditCardId: template.creditCardId,
    },
  });

  const asset = await prisma.marketAsset.upsert({
    where: { userId_symbol_exchange: { userId: user.id, symbol: 'PETR4', exchange: 'B3' } },
    update: { name: 'Petrobras PN', type: 'stock' },
    create: { id: 'seed-asset-petr4', userId: user.id, symbol: 'PETR4', exchange: 'B3', type: 'stock', name: 'Petrobras PN' },
  });

  await prisma.investment.upsert({
    where: { id: 'seed-investment-1' },
    update: {},
    create: {
      id: 'seed-investment-1',
      userId: user.id,
      marketAssetId: asset.id,
      broker: 'XP',
      type: 'stock',
      quantity: 100,
      buyPrice: 32.5,
      investedAmount: 3250,
      buyDate: civil(`${curYear}-${pad(curMonth)}-01`),
    },
  });

  await prisma.goal.upsert({
    where: { id: 'seed-goal-trip' },
    update: {},
    create: {
      id: 'seed-goal-trip',
      userId: user.id,
      name: 'Viagem de fim de ano',
      type: 'saving',
      targetAmount: 12000,
      currentAmount: 4500,
      deadline: civil(`${curYear}-12-31`),
      relatedAccountId: investAccount.id,
    },
  });

  console.log(`Seed OK. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
