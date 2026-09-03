import { NotFoundException } from '@nestjs/common';

/**
 * Ownership check used by every service.
 *
 * Returning 404 (not 403) for a row that exists but belongs to somebody else is
 * deliberate: a 403 confirms the id is real, which is an enumeration oracle
 * across tenants. The caller cannot tell "does not exist" from "not yours".
 */
export function assertOwned<T extends { userId: string | null }>(
  row: T | null | undefined,
  userId: string,
  what = 'Recurso',
): T {
  if (!row || row.userId !== userId) {
    throw new NotFoundException(`${what} não encontrado.`);
  }
  return row;
}
