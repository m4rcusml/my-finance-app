import type { ImportFileType } from '@finance/contracts';
import { parse } from 'csv-parse/sync';
import type { FileParser, RawImportRow } from './parser.interface';
import { decodeText, findHeaderRowIndex, isBlankRecord, normaliseHeader, sniffDelimiter } from './parser.utils';

/**
 * CSV statements, comma- or semicolon-separated, with or without a preamble.
 *
 * Fixed here versus the previous parser:
 *  - a UTF-8 BOM is stripped before anything else. With the BOM in place the
 *    first column was named `\ufeffData`, every lookup missed and the file
 *    previewed as zero rows with no error at all;
 *  - the delimiter is sniffed from the header line (`;` vs `,` vs tab vs pipe)
 *    instead of "does the first line contain a semicolon";
 *  - the bank preamble above the header is skipped;
 *  - blank and duplicate column names no longer make csv-parse throw.
 */
export class CsvParser implements FileParser {
  readonly fileType: ImportFileType = 'csv';

  async parse(buffer: Buffer): Promise<RawImportRow[]> {
    const content = decodeText(buffer);
    if (content.trim().length === 0) return [];

    const lines = content.split(/\r?\n/);
    const headerIndex = findHeaderRowIndex(lines.map((line) => splitPreview(line)));
    if (headerIndex < 0) return [];

    const delimiter = sniffDelimiter(lines[headerIndex]);
    const body = lines.slice(headerIndex).join('\n');

    const records = parse(body, {
      bom: true,
      columns: (header: unknown[]) => normaliseHeader(header),
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
    }) as Record<string, unknown>[];

    const rows: RawImportRow[] = [];
    for (const record of records) {
      if (isBlankRecord(record)) continue;
      rows.push({ rowNumber: rows.length + 1, data: record });
    }
    return rows;
  }
}

/**
 * Cheap split used only to decide which line is the header. The real parse is
 * done by csv-parse; this just needs to see the column names.
 */
function splitPreview(line: string): string[] {
  return line.split(sniffDelimiter(line)).map((cell) => cell.replace(/"/g, '').trim());
}
