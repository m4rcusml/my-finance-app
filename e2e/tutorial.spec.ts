import { expect, test } from '@playwright/test';
import { makeIdentity, navigate } from './helpers';

test('tutorial apresenta a interface, conclui e pode ser reaberto', async ({ page }) => {
  const identity = makeIdentity('tutorial');
  const expectPanelOutsideSpotlight = () =>
    expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document.querySelector<HTMLElement>('[data-guided-tour-portal="true"] [role="dialog"]');
          const spotlight = document.querySelector<HTMLElement>('[data-testid="tour-spotlight"]');
          if (!panel || !spotlight) return false;
          const panelRect = panel.getBoundingClientRect();
          const targetRect = spotlight.getBoundingClientRect();
          return (
            panelRect.right <= targetRect.left ||
            panelRect.left >= targetRect.right ||
            panelRect.bottom <= targetRect.top ||
            panelRect.top >= targetRect.bottom
          );
        }),
      )
      .toBe(true);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/register');
  await page.getByLabel('Nome').fill(identity.name);
  await page.getByLabel('E-mail').fill(identity.email);
  await page.getByLabel(/^Senha/).fill(identity.password);
  await page.getByLabel(/^Confirmar senha/).fill(identity.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const tour = page.getByRole('dialog', { name: 'Sua vida financeira em um só lugar' });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole('button', { name: 'Fechar tutorial' })).toBeFocused();
  await expect(tour.getByText('Passo 1 de 8', { exact: true })).toBeVisible();
  await expect(tour.getByRole('progressbar', { name: 'Progresso do tutorial' })).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByTestId('tour-spotlight')).toBeVisible();
  await expectPanelOutsideSpotlight();

  for (let step = 2; step <= 8; step += 1) {
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByText(`Passo ${step} de 8`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('tour-spotlight')).toBeVisible();
    if (step >= 5) {
      await expect(page.locator('[role="dialog"][aria-label="Menu principal"]')).toBeVisible();
    }
    await expectPanelOutsideSpotlight();
  }
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');

  await navigate(page, 'Configurações');
  await page.getByRole('button', { name: 'Refazer tutorial' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('dialog', { name: 'Sua vida financeira em um só lugar' })).toBeVisible();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  const restart = page.getByRole('button', { name: 'Refazer tutorial' }).first();
  await restart.click();
  await expect(page.getByRole('dialog', { name: 'Sua vida financeira em um só lugar' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByTestId('tour-spotlight')).toBeVisible();
  await expectPanelOutsideSpotlight();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(restart).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});
