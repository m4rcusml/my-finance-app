import type { ImportFileType } from '@finance/contracts';

/**
 * Import-screen constants and the two small formatters this slice needs.
 *
 * `MAX_IMPORT_BYTES` mirrors the backend's `MAX_UPLOAD_BYTES` default (5 MB).
 * It is enforced here only to fail fast with a readable message — the server
 * still rejects an oversized file with 413, and that message is what wins.
 */

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** What the file picker offers. Must stay in sync with `IMPORT_FILE_TYPES`. */
export const ACCEPTED_IMPORT_EXTENSIONS = '.csv,.ofx,.xlsx';

export const IMPORT_FILE_TYPE_LABELS: Record<ImportFileType, string> = {
  csv: 'CSV',
  ofx: 'OFX',
  xlsx: 'XLSX',
};

const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** `5242880` -> `5 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${DECIMAL.format(bytes / 1024)} KB`;
  return `${DECIMAL.format(bytes / (1024 * 1024))} MB`;
}

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Formats an `IsoTimestamp` (a real instant, unlike a `CivilDate`) for display.
 * `new Date(iso)` is correct here precisely because the value carries an offset.
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_TIME.format(parsed);
}

/** True when the preview batch can no longer be confirmed. */
export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  const parsed = new Date(expiresAt).getTime();
  return Number.isFinite(parsed) && parsed <= now;
}
