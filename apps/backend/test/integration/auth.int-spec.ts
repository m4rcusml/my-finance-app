import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { createTestApp, PREFIX, resetDatabase, type TestApp } from './harness';

const PASSWORD = 'Senha-Muito-Segura-123';

function cookieValue(headers: string[] | undefined, name: string): string {
  const cookie = headers?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`missing ${name} cookie`);
  return cookie.slice(name.length + 1).split(';', 1)[0];
}

function setCookies(response: request.Response): string[] {
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? value : value ? [value] : [];
}

async function register(agent: TestAgent, email: string): Promise<request.Response> {
  return agent.post(`${PREFIX}/auth/register`).send({ email, password: PASSWORD }).expect(201);
}

describe('refresh session integration', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('bootstraps CSRF without document.cookie and marks its cookie HttpOnly', async () => {
    const response = await testApp.http.get(`${PREFIX}/auth/csrf`).expect(200);
    const cookies = setCookies(response);

    expect(response.body).toEqual({ csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    expect(cookies.some((cookie) => cookie.startsWith('csrf_token=') && /;\s*HttpOnly/i.test(cookie))).toBe(true);
  });

  it('does not let an unknown forged token revoke a victim session', async () => {
    const victim = request.agent(testApp.app.getHttpServer());
    await register(victim, 'victim@example.com');

    const forgedClient = request.agent(testApp.app.getHttpServer());
    const csrf = await forgedClient.get(`${PREFIX}/auth/csrf`).expect(200);
    const forgedToken = randomBytes(32).toString('base64url');

    await forgedClient
      .post(`${PREFIX}/auth/refresh`)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .set('Cookie', `refresh_token=${forgedToken}; csrf_token=${csrf.body.csrfToken}`)
      .expect(401);

    expect(await testApp.prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(1);

    const victimCsrf = await victim.get(`${PREFIX}/auth/csrf`).expect(200);
    await victim.post(`${PREFIX}/auth/refresh`).set('X-CSRF-Token', victimCsrf.body.csrfToken).expect(200);
  });

  it('rejects an expired refresh, removes only its row and preserves another session', async () => {
    const server = testApp.app.getHttpServer();
    const expiredSession = await request(server)
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'expired@example.com', password: PASSWORD })
      .expect(201);
    const activeSession = await request(server)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'expired@example.com', password: PASSWORD })
      .expect(200);

    const expiredCookies = setCookies(expiredSession);
    const expiredRefresh = cookieValue(expiredCookies, 'refresh_token');
    const expiredCsrf = cookieValue(expiredCookies, 'csrf_token');
    const expiredHash = createHash('sha256').update(expiredRefresh).digest('hex');
    await testApp.prisma.refreshToken.update({
      where: { tokenHash: expiredHash },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(server)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${expiredRefresh}; csrf_token=${expiredCsrf}`)
      .set('X-CSRF-Token', expiredCsrf)
      .expect(401);

    expect(setCookies(response).some((cookie) => cookie.startsWith('refresh_token=;'))).toBe(true);
    expect(await testApp.prisma.refreshToken.findUnique({ where: { tokenHash: expiredHash } })).toBeNull();
    expect(await testApp.prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(1);

    const activeCookies = setCookies(activeSession);
    const activeRefresh = cookieValue(activeCookies, 'refresh_token');
    const activeCsrf = cookieValue(activeCookies, 'csrf_token');
    await request(server)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${activeRefresh}; csrf_token=${activeCsrf}`)
      .set('X-CSRF-Token', activeCsrf)
      .expect(200);
  });

  it('allows exactly one successor when the same cookie refreshes concurrently', async () => {
    const client = request(testApp.app.getHttpServer());
    const registration = await client
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'race@example.com', password: PASSWORD })
      .expect(201);
    const cookies = setCookies(registration);
    const refreshToken = cookieValue(cookies, 'refresh_token');
    const csrfToken = cookieValue(cookies, 'csrf_token');
    const cookie = `refresh_token=${refreshToken}; csrf_token=${csrfToken}`;

    const responses = await Promise.all([
      client.post(`${PREFIX}/auth/refresh`).set('Cookie', cookie).set('X-CSRF-Token', csrfToken),
      client.post(`${PREFIX}/auth/refresh`).set('Cookie', cookie).set('X-CSRF-Token', csrfToken),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const conflict = responses.find((response) => response.status === 409);
    expect(conflict?.headers['set-cookie']).toBeUndefined();

    const family = await testApp.prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(family).toHaveLength(2);
    expect(family.filter((token) => token.revokedAt === null)).toHaveLength(1);
    expect(family[0].successorTokenId).toBe(family[1].id);
  });

  it('revokes only the matching family when a known tombstone is replayed later', async () => {
    const server = testApp.app.getHttpServer();
    const firstLogin = await request(server)
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'families@example.com', password: PASSWORD })
      .expect(201);
    const secondLogin = await request(server)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'families@example.com', password: PASSWORD })
      .expect(200);

    const firstCookies = setCookies(firstLogin);
    const firstRefresh = cookieValue(firstCookies, 'refresh_token');
    const firstCsrf = cookieValue(firstCookies, 'csrf_token');
    await request(server)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${firstRefresh}; csrf_token=${firstCsrf}`)
      .set('X-CSRF-Token', firstCsrf)
      .expect(200);

    const hash = createHash('sha256').update(firstRefresh).digest('hex');
    const predecessor = await testApp.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hash } });
    const outsideWindow = new Date(Date.now() - 6_000);
    await testApp.prisma.refreshToken.update({
      where: { id: predecessor.id },
      data: { revokedAt: outsideWindow, rotatedAt: outsideWindow },
    });

    await request(server)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${firstRefresh}; csrf_token=${firstCsrf}`)
      .set('X-CSRF-Token', firstCsrf)
      .expect(401);

    expect(
      await testApp.prisma.refreshToken.count({
        where: { familyId: predecessor.familyId, revokedAt: null },
      }),
    ).toBe(0);

    const secondRefresh = cookieValue(setCookies(secondLogin), 'refresh_token');
    const secondCsrf = cookieValue(setCookies(secondLogin), 'csrf_token');
    await request(server)
      .post(`${PREFIX}/auth/refresh`)
      .set('Cookie', `refresh_token=${secondRefresh}; csrf_token=${secondCsrf}`)
      .set('X-CSRF-Token', secondCsrf)
      .expect(200);
  });
});
