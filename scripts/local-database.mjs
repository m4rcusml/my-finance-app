import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = join(root, 'apps', 'backend');
const dataDirectory = join(root, '.local', 'postgres-16');
const requireFromBackend = createRequire(join(backendRoot, 'package.json'));
const requireFromEmbedded = createRequire(requireFromBackend.resolve('embedded-postgres'));

const dotenv = requireFromBackend('dotenv');
dotenv.config({ path: join(backendRoot, '.env'), quiet: true });

function databaseConfig() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL não foi definida em apps/backend/.env. Copie o arquivo .env.example primeiro.');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL não é uma URL PostgreSQL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL precisa usar o protocolo postgresql://.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('db:local só pode iniciar um banco no próprio computador.');
  }

  const port = Number(url.port || 5432);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!Number.isInteger(port) || port < 1 || port > 65_535 || !name || !user || !password) {
    throw new Error('DATABASE_URL precisa informar usuário, senha, banco e uma porta válida.');
  }

  return { host, port, name, user, password };
}

function portIsListening(host, port) {
  return new Promise((resolveListening) => {
    const socket = connect({ host, port });
    const finish = (listening) => {
      socket.destroy();
      resolveListening(listening);
    };
    socket.setTimeout(750);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function canAccess(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function initialiseWhenNeeded(database) {
  const versionFile = join(dataDirectory, 'PG_VERSION');
  if (await canAccess(versionFile)) {
    const version = (await readFile(versionFile, 'utf8')).trim();
    if (version !== '16') {
      throw new Error(
        `O diretório local contém PostgreSQL ${version || 'desconhecido'}, mas a V1 exige PostgreSQL 16.`,
      );
    }
    return;
  }

  const entries = await readdir(dataDirectory);
  if (entries.length > 0) {
    throw new Error('O diretório .local/postgres-16 não está vazio nem contém um cluster PostgreSQL reconhecido.');
  }
  await database.initialise();
}

async function currentDatabaseIsReady(config) {
  if (!(await portIsListening(config.host, config.port))) return false;

  const { Client } = requireFromBackend('pg');
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: 2_000,
    query_timeout: 2_000,
  });
  let versionNumber;
  try {
    await client.connect();
    const result = await client.query('SHOW server_version_num');
    versionNumber = Number(result.rows[0]?.server_version_num);
  } catch {
    throw new Error(
      `A porta ${config.port} já está ocupada, mas DATABASE_URL não conseguiu acessar o banco configurado.`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  const major = Math.floor(versionNumber / 10_000);
  if (major !== 16) {
    throw new Error(
      `O servidor ativo usa PostgreSQL ${Number.isFinite(major) ? major : 'desconhecido'}; a V1 exige 16.`,
    );
  }
  return true;
}

async function ensureDatabaseExists(database, name, host) {
  const client = database.getPgClient('postgres', host);
  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (result.rowCount === 0) await database.createDatabase(name);
  } finally {
    await client.end();
  }
}

function takeOwnershipOfSignals() {
  const exitHook = requireFromEmbedded('async-exit-hook');
  const hookedEvents = new Set(exitHook.hookedEvents());
  const signals = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGBREAK'];
  for (const signal of signals) {
    if (hookedEvents.has(signal)) exitHook.unhookEvent(signal);
  }
  return signals;
}

async function stopDatabase(database, host, port) {
  if (platform() !== 'win32') {
    await database.stop();
    return;
  }

  const binaryEntry = requireFromEmbedded.resolve('@embedded-postgres/windows-x64');
  const { pg_ctl: pgCtl } = await import(pathToFileURL(binaryEntry).href);
  try {
    await new Promise((resolveStop, rejectStop) => {
      execFile(
        pgCtl,
        ['stop', '-D', dataDirectory, '-m', 'fast', '-w'],
        { timeout: 30_000, windowsHide: true },
        (error) => (error ? rejectStop(error) : resolveStop()),
      );
    });
  } catch (error) {
    // Ctrl+C can reach postgres before Node's handler on Windows. In that case
    // postgres has already removed postmaster.pid after its own clean shutdown.
    if (await portIsListening(host, port)) throw error;
  }

  // The dependency's exit hook now sees an already-stopped instance and does
  // not fall back to taskkill /f after pg_ctl completed the clean shutdown.
  database.process = undefined;
}

async function main() {
  const config = databaseConfig();
  if (await currentDatabaseIsReady(config)) {
    console.log(`PostgreSQL já está disponível em ${config.host}:${config.port}/${config.name}.`);
    return;
  }

  const embeddedModule = requireFromBackend('embedded-postgres');
  const EmbeddedPostgres = embeddedModule.default ?? embeddedModule;
  const database = new EmbeddedPostgres({
    databaseDir: dataDirectory,
    user: config.user,
    password: config.password,
    port: config.port,
    authMethod: 'scram-sha-256',
    persistent: true,
    onLog: (message) => {
      if (process.env.LOCAL_DATABASE_VERBOSE === 'true') process.stdout.write(String(message));
    },
    onError: (error) => console.error(error),
  });

  let started = false;
  let stopping = false;
  let stopRequested = false;
  const signals = takeOwnershipOfSignals();
  const stopRequestedPromise = new Promise((resolveStop) => {
    for (const signal of signals) {
      process.once(signal, () => {
        stopRequested = true;
        resolveStop({ type: 'signal' });
      });
    }
  });
  const stop = async () => {
    if ((!started && !database.process) || stopping) return;
    stopping = true;
    await stopDatabase(database, config.host, config.port);
    console.log('PostgreSQL local encerrado; os dados foram preservados em .local/postgres-16.');
  };

  try {
    await mkdir(dataDirectory, { recursive: true });
    await initialiseWhenNeeded(database);
    if (stopRequested) return;

    await database.start();
    started = true;
    await ensureDatabaseExists(database, config.name, config.host);
    if (stopRequested) return;

    console.log(`PostgreSQL 16 pronto em ${config.host}:${config.port}/${config.name}.`);
    console.log('Mantenha este terminal aberto. Para encerrar, pressione Ctrl+C.');

    const postgresProcess = database.process;
    const postgresExited = new Promise((resolveExit) => {
      if (!postgresProcess || postgresProcess.exitCode !== null) {
        resolveExit({
          type: 'exit',
          code: postgresProcess?.exitCode ?? null,
          signal: postgresProcess?.signalCode ?? null,
        });
        return;
      }
      postgresProcess.once('exit', (code, signal) => resolveExit({ type: 'exit', code, signal }));
    });
    const reason = await Promise.race([stopRequestedPromise, postgresExited]);
    if (reason.type === 'exit' && !stopRequested) {
      database.process = undefined;
      started = false;
      throw new Error(`O PostgreSQL local encerrou inesperadamente (código ${reason.code ?? 'n/a'}).`);
    }
  } finally {
    await stop();
  }
}

await main();
