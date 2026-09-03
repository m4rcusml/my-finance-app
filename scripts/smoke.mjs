#!/usr/bin/env node
/**
 * Cross-platform smoke test for a RUNNING backend.
 *
 * Replaces `test_backend.ps1`, which pointed at port 3000 (the frontend), omitted
 * the `/api/v1` prefix on several calls and sent uppercase enum values that the
 * DTOs reject. This runs anywhere Node runs and is what CI executes against the
 * artifact produced by `pnpm --filter backend build` and started with
 * `pnpm --filter backend start:prod`.
 *
 *   node scripts/smoke.mjs [--base http://localhost:3001] [--keep]
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const BASE = (flag('base', process.env.SMOKE_BASE_URL ?? 'http://localhost:3001')).replace(/\/+$/, '');
const API = `${BASE}/api/v1`;
const KEEP = args.includes('--keep');

let passed = 0;
const failures = [];

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, { body, token, expect } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${path.startsWith('http') ? '' : API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => undefined);
  } else {
    payload = await res.text().catch(() => undefined);
  }

  if (expect !== undefined && res.status !== expect) {
    const shown = typeof payload === 'string' ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 300);
    throw new Error(`${method} ${path} -> ${res.status}, expected ${expect}. Body: ${shown}`);
  }
  return { status: res.status, body: payload, headers: res.headers };
}

async function waitForReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health/ready`);
      if (res.ok) return true;
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`backend never became ready at ${BASE}/health/ready (${lastError})`);
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

async function main() {
  console.log(`Smoke test against ${API}\n`);
  await waitForReady();

  // --- public surface ------------------------------------------------------
  const live = await call('GET', `${BASE}/health/live`, { expect: 200 });
  record('GET /health/live returns ok', live.body?.status === 'ok', JSON.stringify(live.body));

  const ready = await call('GET', `${BASE}/health/ready`, { expect: 200 });
  record('GET /health/ready reports the database', ready.body?.checks?.database === 'ok');

  await call('GET', '/accounts', { expect: 401 });
  record('private route without a token is 401', true);

  // --- register / login ----------------------------------------------------
  const email = `smoke.${Date.now()}@example.com`;
  const password = 'Senha-De-Fumaca-123';

  const registered = await call('POST', '/auth/register', {
    body: { email, password, name: 'Smoke Test' },
    expect: 201,
  });
  const token = registered.body?.accessToken;
  record('POST /auth/register returns an access token', typeof token === 'string' && token.length > 20);
  record('register response omits passwordHash', !JSON.stringify(registered.body).includes('passwordHash'));

  const badLogin = await call('POST', '/auth/login', { body: { email, password: 'senha-errada-aqui' } });
  record('wrong password is 401', badLogin.status === 401, `got ${badLogin.status}`);

  const unknownLogin = await call('POST', '/auth/login', {
    body: { email: `nobody.${Date.now()}@example.com`, password },
  });
  record('unknown e-mail is also 401 (no account enumeration)', unknownLogin.status === 401, `got ${unknownLogin.status}`);
  record(
    'both login failures share one message',
    badLogin.body?.message === unknownLogin.body?.message,
    `${badLogin.body?.message} vs ${unknownLogin.body?.message}`,
  );

  const login = await call('POST', '/auth/login', { body: { email, password }, expect: 200 });
  const authToken = login.body?.accessToken ?? token;
  record('POST /auth/login succeeds', typeof authToken === 'string');

  // --- core CRUD -----------------------------------------------------------
  const account = await call('POST', '/accounts', {
    token: authToken,
    body: { name: 'Conta Smoke', institution: 'Banco Smoke', type: 'checking', initialBalance: 1000 },
    expect: 201,
  });
  record('POST /accounts accepts the lowercase enum', typeof account.body?.id === 'string');

  const badType = await call('POST', '/accounts', {
    token: authToken,
    body: { name: 'X', institution: 'Y', type: 'CHECKING', initialBalance: 0 },
  });
  record('uppercase enum is rejected with 400', badType.status === 400, `got ${badType.status}`);

  const accounts = await call('GET', '/accounts', { token: authToken, expect: 200 });
  record(
    'GET /accounts returns the { data, meta } envelope',
    Array.isArray(accounts.body?.data) && typeof accounts.body?.meta?.totalItems === 'number',
    JSON.stringify(accounts.body).slice(0, 200),
  );
  record('meta carries pagination flags', typeof accounts.body?.meta?.hasNextPage === 'boolean');

  const category = await call('POST', '/categories', {
    token: authToken,
    body: { name: 'Alimentação', type: 'expense' },
    expect: 201,
  });

  const card = await call('POST', '/credit-cards', {
    token: authToken,
    body: { name: 'Cartão Smoke', institution: 'Banco Smoke', limitTotal: 5000, closingDay: 10 },
    expect: 201,
  });
  record('credit card exposes the current cycle', Boolean(card.body?.currentCycle?.start && card.body?.currentCycle?.end));

  const tx = await call('POST', '/transactions', {
    token: authToken,
    body: {
      type: 'expense',
      value: 123.45,
      date: today,
      accountId: account.body.id,
      categoryId: category.body.id,
      description: 'Compra smoke',
    },
    expect: 201,
  });
  record('transaction date round-trips as a civil date', tx.body?.date === today, `got ${tx.body?.date}`);

  const bothSources = await call('POST', '/transactions', {
    token: authToken,
    body: { type: 'expense', value: 1, date: today, accountId: account.body.id, creditCardId: card.body.id },
  });
  record('two sources on one transaction is rejected', bothSources.status === 400, `got ${bothSources.status}`);

  const noSource = await call('POST', '/transactions', {
    token: authToken,
    body: { type: 'expense', value: 1, date: today },
  });
  record('zero sources on a transaction is rejected', noSource.status === 400, `got ${noSource.status}`);

  const clearCategory = await call('PATCH', `/transactions/${tx.body.id}`, {
    token: authToken,
    body: { categoryId: null },
  });
  record(
    'PATCH with an explicit null clears the category',
    clearCategory.status === 200 && clearCategory.body?.categoryId === null,
    `status ${clearCategory.status}, categoryId ${JSON.stringify(clearCategory.body?.categoryId)}`,
  );

  // --- dashboard -----------------------------------------------------------
  const dashboard = await call('GET', '/dashboard', { token: authToken, expect: 200 });
  record('dashboard separates cash from investment balances',
    typeof dashboard.body?.totals?.netBalance === 'number' &&
      typeof dashboard.body?.totals?.investedAccountBalance === 'number');
  record('dashboard returns 12 months of history', dashboard.body?.annualBalance?.length === 12,
    `got ${dashboard.body?.annualBalance?.length}`);
  record('dashboard reports the window it used',
    Boolean(dashboard.body?.period?.from && dashboard.body?.period?.to));

  // --- error contract ------------------------------------------------------
  const missing = await call('GET', '/accounts/00000000-0000-0000-0000-000000000000', { token: authToken });
  record('unknown id is 404 with the error contract',
    missing.status === 404 && typeof missing.body?.requestId === 'string' && typeof missing.body?.error === 'string',
    `status ${missing.status}, body ${JSON.stringify(missing.body).slice(0, 200)}`);

  // --- tenant isolation ----------------------------------------------------
  const otherEmail = `smoke.other.${Date.now()}@example.com`;
  const other = await call('POST', '/auth/register', {
    body: { email: otherEmail, password, name: 'Outro' },
    expect: 201,
  });
  const otherToken = other.body.accessToken;

  const leak = await call('GET', `/accounts/${account.body.id}`, { token: otherToken });
  record("another user cannot read this user's account", leak.status === 404, `got ${leak.status}`);

  const otherAccounts = await call('GET', '/accounts', { token: otherToken, expect: 200 });
  record('a fresh user sees an empty, well-formed list',
    Array.isArray(otherAccounts.body?.data) && otherAccounts.body.data.length === 0);

  // --- cleanup -------------------------------------------------------------
  if (!KEEP) {
    for (const [t, mail] of [[authToken, email], [otherToken, otherEmail]]) {
      const res = await call('DELETE', '/users/me', {
        token: t,
        body: { password, confirmation: 'EXCLUIR MINHA CONTA' },
      });
      record(`DELETE /users/me (${mail.split('@')[0]}) returns 204 with no body`,
        res.status === 204 && !res.body, `status ${res.status}`);
      record('account deletion never returns a password hash',
        !String(res.body ?? '').includes('passwordHash'));
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\nSMOKE ABORTED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
