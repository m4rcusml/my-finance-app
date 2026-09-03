import type { ImportFileType } from '@finance/contracts';

/**
 * One row exactly as it came out of a file, before any bank-specific mapping.
 *
 * `rowNumber` is 1-based and counts **data rows only** — the header, the
 * preamble lines some banks put above it and fully blank lines never consume a
 * number. It is the handle the confirm step uses to pick rows, so it has to be
 * stable for a given file: re-uploading the same bytes must produce the same
 * numbering.
 */
export interface RawImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export interface FileParser {
  readonly fileType: ImportFileType;
  parse(buffer: Buffer): Promise<RawImportRow[]>;
}
