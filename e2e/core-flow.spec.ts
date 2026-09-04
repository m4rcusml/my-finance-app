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
  await expect(page.getByRole('heading', { name: 'Movimentações', exact: true })).toBeVisible();
  const pending = page.getByRole('region', { name: 'Compra pendente E2E', exact: true });
  await expect(pending.getByRole('heading', { name: 'Compra pendente E2E', exact: true })).toBeVisible();
  await expect(pending.getByText(/31,40/)).toBeVisible();
  await pending
    .getByRole('group', { name: 'Qual categoria descreve melhor esta movimentação?' })
    .getByText(category, { exact: true })
    .click();
  await expect(pending.getByRole('radio', { name: category, exact: true })).toBeChecked();
  await pending.getByRole('button', { name: 'Categorizar e ir para a próxima' }).click();
  await expect(page.getByRole('heading', { name: 'Fila concluída' })).toBeVisible();

  await navigate(page, 'Transações');
  const categorized = page
    .getByRole('list', { name: 'Transações', exact: true })
    .getByRole('listitem')
    .filter({
      has: page.getByRole('button', { name: 'Editar transação Compra pendente E2E', exact: true }),
    });
  await expect(categorized.getByText(category, { exact: true })).toBeVisible();
  await expect(categorized.getByText(/31,40/)).toBeVisible();

  await navigate(page, 'Painel');
  await expect(page.getByText('Compra pendente E2E', { exact: true })).toBeVisible();
  await expect(page.getByText(account, { exact: true }).first()).toBeVisible();
});

test('recorrência criada aparece imediatamente, confirma uma única transação e preserva histórico ao reativar', async ({
  page,
}) => {
  const identity = makeIdentity('fixed');
  const account = `Conta recorrente ${identity.email.slice(0, 9)}`;
  const category = `Moradia ${identity.email.slice(0, 9)}`;

  await registerUser(page, identity);
  await createAccount(page, account);
  await createCategory(page, category);
  await navigate(page, 'Recorrentes');

  await page.getByRole('button', { name: 'Nova recorrência' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova recorrência' });
  await dialog.getByLabel('Descrição').fill('Aluguel recorrente E2E');
  await dialog.getByLabel('Valor').fill('850,00');
  await dialog.getByLabel('Dia do vencimento').fill('31');
  await dialog.getByLabel('Margem (dias)').fill('2');
  await dialog.getByLabel('Categoria').selectOption({ label: `${category} · Despesa` });
  await dialog.getByRole('combobox', { name: /^Conta/ }).selectOption({ label: `${account} · Banco E2E` });
  await dialog.getByRole('button', { name: 'Criar recorrência' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Aluguel recorrente E2E' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirmar ocorrência' });
  await confirmation.getByLabel('Valor real').fill('875,50');
  await confirmation.getByRole('button', { name: 'Confirmar agora' }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver lançamento' }).click();
  const transaction = page.getByRole('dialog', { name: 'Lançamento da recorrência' });
  await expect(transaction.getByText(/875,50/)).toBeVisible();
  await transaction.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Modelos', exact: true }).click();
  await expect(page.getByRole('rowheader', { name: 'Aluguel recorrente E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar' }).click();
  await page.getByRole('dialog', { name: 'Arquivar modelo' }).getByRole('button', { name: 'Arquivar' }).click();
  await page.getByLabel('Exibir').selectOption('all');
  await expect(page.getByText('Arquivado', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reativar' }).click();
  await page.getByRole('dialog', { name: 'Reativar modelo' }).getByRole('button', { name: 'Reativar' }).click();
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ocorrências', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aluguel recorrente E2E' })).toHaveCount(1);
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toHaveCount(0);

  await navigate(page, 'Transações');
  await expect(page.getByText('Aluguel recorrente E2E', { exact: true })).toHaveCount(1);
});

test('meta registra progresso manual e mantém o valor após recarregar', async ({ page }) => {
  await registerUser(page, makeIdentity('goal'));
  await navigate(page, 'Metas');
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova meta' });
  await dialog.getByLabel('Nome').fill('Reserva de emergência E2E');
  await dialog.getByLabel('Valor alvo (R$)').fill('1000,00');
  await dialog.getByRole('button', { name: 'Criar meta' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Atualizar progresso' }).click();
  const progress = page.getByRole('dialog', { name: 'Atualizar progresso' });
  await progress.getByLabel('Novo valor guardado (R$)').fill('250,00');
  await progress.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(progress).toBeHidden();
  await expect(page.getByRole('progressbar', { name: /Reserva de emergência E2E/ })).toHaveAttribute(
    'aria-valuenow',
    '25',
  );
  await page.reload();
  await expect(page.getByRole('progressbar', { name: /Reserva de emergência E2E/ })).toHaveAttribute(
    'aria-valuenow',
    '25',
  );
});
