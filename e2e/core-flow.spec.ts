import { expect, test } from '@playwright/test';
import { createAccount, createCategory, createTransaction, makeIdentity, navigate, registerUser } from './helpers';

test('cadastro, conta, categoria, transações, fila e painel', async ({ page }) => {
  const identity = makeIdentity('core');
  const account = `Conta principal ${identity.email.slice(0, 10)}`;
  const category = `Mercado ${identity.email.slice(0, 10)}`;

  await registerUser(page, identity);
  await createAccount(page, account);
  await createCategory(page, category);

  await createTransaction(page, {
    account,
    category,
    description: 'Compra categorizada E2E',
    value: '125,90',
  });
  await createTransaction(page, {
    account,
    description: 'Compra pendente E2E',
    value: '31,40',
  });

  await navigate(page, 'Sem categoria');
  await expect(page.getByRole('heading', { name: 'Fila sem categoria' })).toBeVisible();
  await expect(page.getByText('Compra pendente E2E', { exact: true })).toBeVisible();
  await page.getByLabel('Categoria').selectOption({ label: category });
  await page.getByRole('button', { name: 'Salvar categoria' }).click();
  await expect(page.getByRole('heading', { name: 'Fila concluída' })).toBeVisible();

  await navigate(page, 'Painel');
  await expect(page.getByText('Compra pendente E2E', { exact: true })).toBeVisible();
  await expect(page.getByText(account, { exact: true }).first()).toBeVisible();
});

test('modelo recorrente pode ser criado, arquivado e reativado', async ({ page }) => {
  const identity = makeIdentity('fixed');
  const account = `Conta recorrente ${identity.email.slice(0, 9)}`;
  const category = `Moradia ${identity.email.slice(0, 9)}`;

  await registerUser(page, identity);
  await createAccount(page, account);
  await createCategory(page, category);
  await navigate(page, 'Recorrentes');

  await page.getByRole('tab', { name: 'Modelos' }).click();
  await page.getByRole('button', { name: 'Novo modelo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo modelo recorrente' });
  await dialog.getByLabel('Descrição').fill('Aluguel recorrente E2E');
  await dialog.getByLabel('Valor').fill('850,00');
  await dialog.getByLabel('Dia de referência').fill('31');
  await dialog.getByLabel('Margem (dias)').fill('2');
  await dialog.getByLabel('Categoria').selectOption({ label: `${category} · Despesa` });
  await dialog.getByRole('combobox', { name: /^Conta/ }).selectOption({ label: `${account} · Banco E2E` });
  await dialog.getByRole('button', { name: 'Criar modelo' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('rowheader', { name: 'Aluguel recorrente E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar' }).click();
  await page.getByRole('dialog', { name: 'Arquivar modelo' }).getByRole('button', { name: 'Arquivar' }).click();
  await page.getByLabel('Exibir').selectOption('all');
  await expect(page.getByText('Arquivado', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reativar' }).click();
  await page.getByRole('dialog', { name: 'Reativar modelo' }).getByRole('button', { name: 'Reativar' }).click();
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
});
