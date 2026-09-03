import { createHash } from 'node:crypto';
import type { CivilDate, ImportOrigin, Money } from '@finance/contracts';

/**
 * Deduplication keys.
 *
 * `transactions` carries a partial unique index on `(user_id, external_id)`, so
 * the database — not a best-effort scan of the user's whole ledger, which is
 * what the previous implementation did — is what actually stops a double
 * import. That only works if the same file always yields the same ids, hence
 * these two deterministic recipes.
 */

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** SHA-256 of the uploaded bytes; identifies a re-upload of the same file. */
export function hashFileContents(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface ExternalIdInput {
  origin: ImportOrigin;
  fileHash: string;
  rowNumber: number;
  date: CivilDate;
  value: Money;
  description: string | null;
  /** `FITID` in OFX, an `Id` column in a spreadsheet. */
  sourceId?: string | null;
}

/**
 * The stable id of an imported row.
 *
 * When the file supplies its own id (OFX `FITID`) that id is authoritative and
 * the hash deliberately leaves out `fileHash`: the same transaction exported
 * again next month, in a different file, must collide with the one already
 * stored. Otherwise the id is derived from the content of the row plus the
 * bytes of the file, so re-uploading the *same* file produces the same ids and
 * imports zero rows the second time.
 */
export function buildExternalId(input: ExternalIdInput): string {
  const sourceId = input.sourceId?.trim();
  if (sourceId) return sha256Hex([input.origin, 'fitid', sourceId].join('|'));

  return sha256Hex(
    [
      input.origin,
      input.fileHash,
      String(input.rowNumber),
      input.date,
      input.value.toFixed(2),
      (input.description ?? '').trim().toLowerCase(),
    ].join('|'),
  );
}
