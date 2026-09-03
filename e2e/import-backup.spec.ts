import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { createAccount, makeIdentity, navigate, registerUser } from './helpers';

test('importação com prévia e round-trip de backup em modo merge', async ({ page }) => {
  const identity = makeIdentity('portable');
  const account = `Conta importação ${identity.email.slice(0, 8)}`;

  await registerUser(page, identity);
  await createAccount(page, account);
  await navigate(page, 'Importações');

  await page.getByLabel('Arquivo').setInputFiles(resolve('apps/backend/test/fixtures/imports/inter-extrato.csv'));
  await page.getByRole('button', { name: 'Analisar arquivo' }).click();
  await expect(page.getByRole('heading', { name: '2. Pré-visualização' })).toBeVisible();
  await page.getByLabel('Conta de destino').selectOption({ label: `${account} — Banco E2E` });
  await page.getByRole('button', { name: /^Importar \d+ linha/ }).click();
  await expect(page.getByRole('heading', { name: '3. Importação concluída' })).toBeVisible();
  await expect(page.getByText('reimportar o mesmo arquivo não cria duplicatas')).toBeVisible();

  await navigate(page, 'Backup');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar backup JSON' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  await page.getByLabel('Arquivo JSON').setInputFiles(backupPath as string);
  await page.getByLabel('Modo de restauração').selectOption('merge');
  await page.getByRole('button', { name: 'Mesclar dados do arquivo' }).click();
  await page.getByRole('dialog', { name: 'Mesclar o backup?' }).getByRole('button', { name: 'Mesclar backup' }).click();
  await expect(page.getByRole('heading', { name: 'Restauração concluída' })).toBeVisible();
});
