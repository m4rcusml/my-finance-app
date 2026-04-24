import * as xlsx from 'xlsx';
import type { FileParser, ParsedRow } from './parser.interface';

export class XlsxParser implements FileParser {
  supports(mimeType: string, ext: string): boolean {
    return (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      ext === '.xlsx' ||
      ext === '.xls'
    );
  }

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return [];
    }
    const records = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as ParsedRow[];
    return records;
  }
}
