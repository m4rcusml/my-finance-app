import { rmSync } from 'node:fs';
import { join } from 'node:path';

export default async function globalTeardown() {
  const db = (globalThis as { __TEST_DB__?: { stop: () => Promise<void> } }).__TEST_DB__;
  if (db) await db.stop();
  rmSync(join(__dirname, '.db-url'), { force: true });
}
