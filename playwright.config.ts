import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 3100);
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 3101);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:55433/finance_browser_e2e';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/playwright',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node scripts/e2e-database.mjs',
      url: 'http://127.0.0.1:55434/ready',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter backend exec nest start --path tsconfig.browser.json',
      port: backendPort,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        PORT: String(backendPort),
        DATABASE_URL: databaseUrl,
        JWT_SECRET: process.env.JWT_SECRET ?? 'browser-e2e-access-secret-at-least-32-chars',
        CORS_ORIGINS: frontendUrl,
        APP_TIMEZONE: 'America/Sao_Paulo',
        COOKIE_SECURE: 'false',
        COOKIE_SAMESITE: 'lax',
        ENABLE_CRON: 'false',
        ENABLE_SWAGGER: 'false',
      },
    },
    {
      command: `pnpm --filter frontend exec next dev --port ${frontendPort}`,
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NEXT_PUBLIC_API_URL: `${backendUrl}/api/v1`,
        NEXT_DIST_DIR: '.next-e2e',
      },
    },
  ],
});
