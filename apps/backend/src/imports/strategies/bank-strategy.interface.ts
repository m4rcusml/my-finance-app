import type { CivilDate, ImportOrigin, Money, TransactionType } from '@finance/contracts';
import type { RawImportRow } from '../parsers/parser.interface';

/**
 * One raw row mapped onto the app's vocabulary.
 *
 * A row that cannot be mapped is **not** dropped: it comes back with `errors`
 * filled in so the preview can show the user exactly which line of their file
 * is wrong while the rest of the file stays importable. The old contract
 * (`normalize` returning `null`) silently swallowed bad rows.
 */
export interface NormalizedImportRow {
  rowNumber: number;
  type: TransactionType | null;
  /** Always the absolute amount; direction lives in `type`. */
  value: Money | null;
  date: CivilDate | null;
  description: string | null;
  /** An id the file itself supplies (OFX `FITID`, an `Id` column). */
  sourceId: string | null;
  errors: string[];
}

export interface BankStrategy {
  readonly origin: ImportOrigin;
  normalize(row: RawImportRow): NormalizedImportRow;
}
