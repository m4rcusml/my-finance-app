import { expect, type Page } from '@playwright/test';

export const TEST_PASSWORD = 'E2e-uma-senha-segura-2026!';

export interface TestIdentity {
  email: string;
  name: string;
  password: string;
}

export function makeIdentity(prefix: string): TestIdentity {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    email: `${prefix}-${suffix}@example.test`,
    name: `Pessoa ${prefix} ${suffix.slice(-4)}`,
    password: TEST_PASSWORD,
  };
}

export async function registerUser(page: Page, identity: TestIdentity) {
  await page.goto('/register');
  await page.getByLabel('Nome').fill(identity.name);
  await page.getByLabel('E-mail').fill(identity.email);
  await page.getByLabel(/^Senha/).fill(identity.password);
  await page.getByLabel(/^Confirmar senha/).fill(identity.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const skipTour = page.getByRole('button', { name: 'Pular tutorial' });
  await expect(skipTour).toBeVisible();
  await skipTour.click();
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();
}

export async function loginUser(page: Page, identity: TestIdentity) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(identity.email);
  await page.getByLabel('Senha').fill(identity.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function logoutUser(page: Page) {
  await page
    .getByRole('button', { name: /^Sair da conta$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function navigate(page: Page, label: string) {
  const consolidatedRoutes: Record<string, { section: string; navigation: string; tab: string }> = {
    Backup: { section: 'Configurações', navigation: 'Seções de configurações', tab: 'Dados e backup' },
    Categorias: { section: 'Movimentações', navigation: 'Seções de movimentações', tab: 'Categorias' },
    'Sem categoria': { section: 'Movimentações', navigation: 'Seções de movimentações', tab: 'Sem categoria' },
  };
  const consolidated = consolidatedRoutes[label];
  if (consolidated) {
    await navigate(page, consolidated.section);
    await page
      .getByRole('navigation', { name: consolidated.navigation })
      .getByRole('link', { name: consolidated.tab, exact: true })
      .click();
    return;
  }
  const visibleLabel = label === 'Painel' ? 'Dashboard' : label === 'Transações' ? 'Movimentações' : label;
  const escapedLabel = visibleLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page
    .getByRole('link', { name: new RegExp(`^${escapedLabel}(?:\\s|$)`) })
    .first()
    .click();
}

export async function createAccount(page: Page, name: string) {
  await navigate(page, 'Contas');
  await expect(page.getByRole('heading', { name: 'Contas e cartões' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar conta ou cartão' }).click();
  await page
    .getByRole('dialog', { name: 'Adicionar conta ou cartão' })
    .getByRole('button', { name: /^Nova conta/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Nova conta' });
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByLabel('Instituição').fill('Banco E2E');
  await dialog.getByLabel('Saldo inicial').fill('1000,00');
  await dialog.getByRole('button', { name: 'Criar conta' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

export async function createCategory(page: Page, name: string) {
  await navigate(page, 'Categorias');
  const form = page.getByRole('region', { name: 'Nova categoria' });
  await expect(form).toBeVisible();
  await form.getByLabel('Nome').fill(name);
  await form.getByLabel('Tipo').selectOption('expense');
  await form.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

export async function createTransaction(
  page: Page,
  input: { account: string; category?: string; description: string; value?: string },
) {
  await navigate(page, 'Transações');
  await expect(page.getByRole('heading', { name: 'Movimentações', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova transação' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova transação' });
  await dialog.getByLabel('Valor').fill(input.value ?? '42,50');
  await dialog.getByRole('combobox', { name: /^Conta/ }).selectOption({ label: input.account });
  if (input.category) {
    await dialog.getByLabel('Categoria').selectOption({ label: input.category });
  }
  await dialog.getByLabel('Descrição').fill(input.description);
  await dialog.getByRole('button', { name: 'Salvar transação' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(input.description, { exact: true }).first()).toBeVisible();
}
