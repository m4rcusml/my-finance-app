import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runMigrations, startTestDatabase } from './postgres';

/**
 * Boots one PostgreSQL for the whole integration run and applies the real
 * migrations. The connection string is handed to the workers through a temp
 * file because Jest global setup and test workers do not share `process.env`.
 */
export default async function globalSetup() {
  const db = await startTestDatabase();
  runMigrations(db.url);

  process.env.TEST_DATABASE_URL_RESOLVED = db.url;
  writeFileSync(join(__dirname, '.db-url'), db.url, 'utf8');

  (globalThis as { __TEST_DB__?: { stop: () => Promise<void> } }).__TEST_DB__ = db;
}
