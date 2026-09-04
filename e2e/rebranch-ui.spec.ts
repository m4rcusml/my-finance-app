import { expect, test } from '@playwright/test';
import { createAccount, createCategory, createTransaction, makeIdentity, registerUser } from './helpers';

test.use({ actionTimeout: 15_000 });

test('telas consolidadas do Figma: dados reais, navegação e layouts responsivos', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const identity = makeIdentity('figma');
  await registerUser(page, identity);
  await createAccount(page, 'Conta principal');
  await createCategory(page, 'Alimentação');
  await createTransaction(page, {
    account: 'Conta principal',
    category: 'Alimentação',
    description: 'Mercado da semana',
    value: '125,90',
  });
  await createTransaction(page, {
    account: 'Conta principal',
    description: 'Lançamento para revisar',
    value: '68,40',
  });
  await expect(page.getByRole('button', { name: 'Fechar notificação' })).toHaveCount(0);

  const screens = [
    ['/dashboard', /^Olá/, 'dashboard'],
    ['/transactions', /^Movimentações$/, 'movimentacoes'],
    ['/transactions?view=uncategorized', /^Movimentações$/, 'fila'],
    ['/transactions?view=categories', /^Categorias cadastradas$/, 'categorias'],
    ['/accounts', /^Contas e cartões$/, 'patrimonio'],
    ['/fixed-transactions', /^Recorrentes$/, 'recorrentes'],
    ['/investments', /^Investimentos$/, 'investimentos'],
    ['/goals', /^Metas$/, 'metas'],
    ['/imports', /^Importações$/, 'importacoes'],
    ['/settings', /^Configurações$/, 'configuracoes'],
  ] as const;
  for (const [route, heading, name] of screens) {
    const rootRoute = route.split('?')[0];
    await page.locator(`a[href="${rootRoute}"]:visible`).first().click();
    if (route.includes('?')) await page.locator(`a[href="${route}"]:visible`).first().click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(page.getByText(/Carregando/).first()).toBeHidden();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
          message: `${route}: overflow em ${width}px`,
        })
        .toBeLessThanOrEqual(1);
      if (width === 375 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
      }
    }
  }
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(identity.name);
  await page.locator('a[href="/settings?view=security"]').first().click();
  await expect(page.getByRole('button', { name: 'Excluir minha conta', exact: true })).toBeDisabled();
});

test('acesso alterna entre entrar e cadastrar sem perder a navegação mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('login-mobile.png'), fullPage: true });
  await page.getByRole('navigation', { name: 'Acesso' }).getByRole('link', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('cadastro-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.screenshot({ path: testInfo.outputPath('cadastro-desktop.png'), fullPage: true });
});
