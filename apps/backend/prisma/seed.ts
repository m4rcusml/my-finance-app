import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from './generated/client';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL not set');
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await argon2.hash('password123');

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
    },
  });

  const account1 = await prisma.account.upsert({
    where: { id: 'seed-account-1' },
    update: {},
    create: {
      id: 'seed-account-1',
      userId: user.id,
      name: 'Conta Corrente',
      institution: 'Banco Inter',
      type: 'checking',
      initialBalance: 5000,
    },
  });

  const account2 = await prisma.account.upsert({
    where: { id: 'seed-account-2' },
    update: {},
    create: {
      id: 'seed-account-2',
      userId: user.id,
      name: 'Poupança',
      institution: 'Nubank',
      type: 'savings',
      initialBalance: 10000,
    },
  });

  const categoryFood = await prisma.category.upsert({
    where: { id: 'seed-category-food' },
    update: {},
    create: {
      id: 'seed-category-food',
      userId: user.id,
      name: 'Alimentação',
      type: 'expense',
    },
  });

  const categoryTransport = await prisma.category.upsert({
    where: { id: 'seed-category-transport' },
    update: {},
    create: {
      id: 'seed-category-transport',
      userId: user.id,
      name: 'Transporte',
      type: 'expense',
    },
  });

  const categorySalary = await prisma.category.upsert({
    where: { id: 'seed-category-salary' },
    update: {},
    create: {
      id: 'seed-category-salary',
      userId: user.id,
      name: 'Salário',
      type: 'income',
    },
  });

  const creditCard = await prisma.creditCard.upsert({
    where: { id: 'seed-cc-1' },
    update: {},
    create: {
      id: 'seed-cc-1',
      userId: user.id,
      name: 'Cartão Nubank',
      institution: 'Nubank',
      limitTotal: 5000,
      closingDay: 10,
    },
  });

  const marketAsset = await prisma.marketAsset.upsert({
    where: { id: 'seed-asset-1' },
    update: {},
    create: {
      id: 'seed-asset-1',
      userId: user.id,
      symbol: 'PETR4',
      type: 'stock',
      exchange: 'B3',
      name: 'Petrobras PN',
    },
  });

  const transactions = [
    {
      type: 'income' as const,
      value: 5000,
      date: new Date('2026-04-01'),
      accountId: account1.id,
      categoryId: categorySalary.id,
      description: 'Salário Abril',
      source: 'manual',
    },
    {
      type: 'expense' as const,
      value: 150,
      date: new Date('2026-04-02'),
      accountId: account1.id,
      categoryId: categoryFood.id,
      description: 'Almoço',
      source: 'manual',
    },
    {
      type: 'expense' as const,
      value: 45,
      date: new Date('2026-04-03'),
      creditCardId: creditCard.id,
      categoryId: categoryTransport.id,
      description: 'Uber',
      source: 'manual',
    },
    {
      type: 'expense' as const,
      value: 200,
      date: new Date('2026-04-05'),
      accountId: account1.id,
      categoryId: categoryFood.id,
      description: 'Supermercado',
      source: 'manual',
    },
    {
      type: 'expense' as const,
      value: 80,
      date: new Date('2026-04-07'),
      creditCardId: creditCard.id,
      categoryId: categoryFood.id,
      description: 'Jantar',
      source: 'manual',
    },
  ];

  for (const txn of transactions) {
    await prisma.transaction.create({ data: { ...txn, userId: user.id } });
  }

  await prisma.fixedTransaction.create({
    data: {
      userId: user.id,
      type: 'expense',
      value: 1200,
      referenceDay: 5,
      marginDays: 3,
      accountId: account1.id,
      categoryId: categoryFood.id,
      description: 'Aluguel',
      isActive: true,
    },
  });

  await prisma.investment.create({
    data: {
      userId: user.id,
      marketAssetId: marketAsset.id,
      broker: 'XP Investimentos',
      type: 'stock',
      quantity: 100,
      buyPrice: 35,
      investedAmount: 3500,
      buyDate: new Date('2026-01-15'),
    },
  });

  await prisma.goal.create({
    data: {
      userId: user.id,
      name: 'Fundo de Emergência',
      type: 'savings',
      targetAmount: 20000,
      currentAmount: 10000,
      deadline: new Date('2026-12-31'),
      relatedAccountId: account2.id,
    },
  });

  console.log('✅ Seed completed');
  console.log(`   User: ${user.email}`);
  console.log(`   Accounts: 2`);
  console.log(`   Categories: 3`);
  console.log(`   Credit Cards: 1`);
  console.log(`   Transactions: ${transactions.length}`);
  console.log(`   Fixed Transactions: 1`);
  console.log(`   Investments: 1`);
  console.log(`   Goals: 1`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
