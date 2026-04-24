import { parse } from 'csv-parse/sync';
import type { FileParser, ParsedRow } from './parser.interface';

export class CsvParser implements FileParser {
  supports(mimeType: string, ext: string): boolean {
    return mimeType === 'text/csv' || mimeType === 'application/csv' || ext === '.csv';
  }

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const content = buffer.toString('utf-8');
    const firstLine = content.split('\n')[0] ?? '';
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter,
      relax_column_count: true,
    }) as ParsedRow[];
    return records;
  }
}
