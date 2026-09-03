import type { ImportFileType } from '@finance/contracts';
import * as xlsx from 'xlsx';
import type { FileParser, RawImportRow } from './parser.interface';
import { findHeaderRowIndex, isBlankCell, normaliseHeader } from './parser.utils';

/**
 * XLSX/XLS statements.
 *
 * The sheet is read as a matrix rather than through `sheet_to_json`'s object
 * mode so that (a) a bank preamble above the header can be skipped and (b)
 * **date cells stay numeric Excel serials**. The previous parser let SheetJS
 * stringify them, `parseDate` could not read `45383`, and every row of a
 * spreadsheet whose dates were real dates rather than text was dropped without
 * a word. `parseCivilDateValue` converts the serial.
 */
export class XlsxParser implements FileParser {
  readonly fileType: ImportFileType = 'xlsx';

  async parse(buffer: Buffer): Promise<RawImportRow[]> {
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, cellText: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const matrix = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    if (matrix.length === 0) return [];

    const headerIndex = findHeaderRowIndex(matrix);
    if (headerIndex < 0) return [];

    const header = normaliseHeader(matrix[headerIndex]);
    const rows: RawImportRow[] = [];

    for (const cells of matrix.slice(headerIndex + 1)) {
      if (!Array.isArray(cells) || cells.every(isBlankCell)) continue;
      const data: Record<string, unknown> = {};
      header.forEach((name, column) => {
        data[name] = cells[column] ?? null;
      });
      rows.push({ rowNumber: rows.length + 1, data });
    }
    return rows;
  }
}
