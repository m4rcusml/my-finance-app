import { CsvParser } from './csv.parser';
import { OfxParser } from './ofx.parser';
import type { FileParser } from './parser.interface';
import { XlsxParser } from './xlsx.parser';

const parsers: FileParser[] = [new CsvParser(), new XlsxParser(), new OfxParser()];

export class ParserFactory {
  static getParser(mimeType: string, originalName: string): FileParser {
    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
    const parser = parsers.find((p) => p.supports(mimeType, ext));
    if (!parser) {
      throw new Error(`Unsupported file type: ${mimeType} (${ext})`);
    }
    return parser;
  }
}
