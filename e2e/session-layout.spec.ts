import { expect, test } from '@playwright/test';
import { createAccount, loginUser, logoutUser, makeIdentity, navigate, registerUser } from './helpers';

test('troca de usuário não reaproveita cache financeiro privado', async ({ page }) => {
  const first = makeIdentity('first');
  const second = makeIdentity('second');
  const privateAccount = `Somente ${first.email}`;

  await registerUser(page, first);
  await createAccount(page, privateAccount);
  await logoutUser(page);

  await page.getByRole('link', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome').fill(second.name);
  await page.getByLabel('E-mail').fill(second.email);
  await page.getByLabel(/^Senha/).fill(second.password);
  await page.getByLabel(/^Confirmar senha/).fill(second.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigate(page, 'Contas');
  await expect(page.getByText(privateAccount, { exact: true })).toHaveCount(0);

  await logoutUser(page);
  await loginUser(page, first);
  await navigate(page, 'Contas');
  await expect(page.getByText(privateAccount, { exact: true }).first()).toBeVisible();
});

test('shell e diálogos permanecem operáveis nos cinco breakpoints', async ({ page }) => {
  const identity = makeIdentity('layout');
  await registerUser(page, identity);
  await expect(page.getByRole('heading', { name: 'Balanço anual' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 760 },
    { width: 768, height: 900 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect(page.getByRole('main')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
        message: `overflow horizontal em ${viewport.width}px`,
      })
      .toBeLessThanOrEqual(1);

    if (viewport.width < 1024) {
      const toggle = page.getByRole('button', { name: 'Abrir menu' });
      await toggle.click();
      const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
      const close = page.getByRole('button', { name: 'Fechar menu' });
      const mobileLogout = navigation.getByRole('button', { name: 'Sair' });
      await expect(navigation).toBeVisible();
      await expect(close).toBeFocused();
      await expect(page.locator('main')).toHaveAttribute('inert', '');
      await page.keyboard.press('Shift+Tab');
      await expect(mobileLogout).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
    }
  }

  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await navigate(page, 'Contas');
  await expect(page.getByRole('heading', { name: 'Contas' })).toBeVisible();
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await expect(page.locator('main')).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Nova conta' }).first();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Nova conta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Nova conta' })).toBeHidden();
  await expect(trigger).toBeFocused();
});
